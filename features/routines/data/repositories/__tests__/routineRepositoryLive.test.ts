import { Chunk, Effect, Either, Layer, PubSub, Queue, TestClock } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { anotherRoutineItem, aRoutine, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { RoutineRepositoryLive } from '@/features/routines/data/repositories/routineRepositoryLive';
import { RoutineEventsLive } from '@/features/routines/data/services/routineEventsLive';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { RoutineEvents } from '@/features/routines/domain/services/RoutineEvents';
import { uniformSets } from '@/features/routines/domain/utils/itemTargets';

const NOW = 1_750_000_000_000;

const layer = () =>
  RoutineRepositoryLive.pipe(Layer.provideMerge(RoutineEventsLive), Layer.provideMerge(makeMigratedSqliteLayer()));

const run = (sql: string, params: (string | number | null)[] = []) =>
  Effect.flatMap(SqliteClient, db => Effect.promise(() => db.runAsync(sql, params)));

const rows = <T>(sql: string, params: (string | number | null)[] = []) =>
  Effect.flatMap(SqliteClient, db => Effect.promise(() => db.getAllAsync<T>(sql, params)));

/** Stores an exercise for items to point at, as a routine save does before it writes them. */
const storeExercise = (id: string, name: string) =>
  run(
    `INSERT INTO exercises (id, name, external_id, instructions, category, primary_muscles,
       secondary_muscles, equipment, image_url, thumbnail_url, source, captured_at)
     VALUES (?, ?, NULL, NULL, NULL, '[]', '[]', '[]', NULL, NULL, 'local', 0)`,
    [id, name],
  );

const storeExercises = Effect.all([
  storeExercise('ex:barbell-bench-press', 'Bench Press'),
  storeExercise('ex:barbell-squat', 'Overhead Press'),
  storeExercise('ex:dips', 'Dips'),
]);

/** A routine saved at `NOW` with the builder's two items. */
const savePushDay = Effect.gen(function* () {
  yield* TestClock.setTime(NOW);
  yield* storeExercises;
  const push = aRoutine();
  return yield* (yield* RoutineRepository).save({ id: push.id, name: push.name, items: push.items });
});

/** What `effect` published on `RoutineEvents`, in order. */
const published = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const subscription = yield* PubSub.subscribe(yield* RoutineEvents);
      yield* effect;
      return Chunk.toReadonlyArray(yield* Queue.takeAll(subscription));
    }),
  );

const PUSH = RoutineId.make('rtn_push');
const DIPS: RoutineItem = aRoutineItem({ id: 'rit_dips', exerciseId: 'ex:dips', exerciseName: 'Dips' });

describe('RoutineRepositoryLive save and reads', () => {
  itEffect(
    'saves a new routine and reads it back with its items in order',
    Effect.gen(function* () {
      const saved = yield* savePushDay;

      expect(saved).toEqual(aRoutine({ createdAt: NOW, updatedAt: NOW }));
      expect(yield* (yield* RoutineRepository).byId(PUSH)).toEqual(saved);
    }),
    layer(),
  );

  itEffect(
    'gives a routine saved without an id one of its own',
    Effect.gen(function* () {
      yield* storeExercises;

      const saved = yield* (yield* RoutineRepository).save({ name: 'Legs', items: [DIPS] });

      expect(saved.id).toMatch(/^rtn_/);
      expect(saved.items.map(item => item.id)).toEqual(['rit_dips']);
    }),
    layer(),
  );

  itEffect(
    'stores a blank name as Untitled routine',
    Effect.gen(function* () {
      yield* storeExercises;

      const saved = yield* (yield* RoutineRepository).save({ name: '   ', items: [DIPS] });

      expect(saved.name).toBe('Untitled routine');
    }),
    layer(),
  );

  itEffect(
    'replaces the items wholesale and keeps the creation time when saving over a routine',
    Effect.gen(function* () {
      yield* savePushDay;
      yield* TestClock.setTime(NOW + 5_000);

      const saved = yield* (yield* RoutineRepository).save({ id: PUSH, name: 'Push Day B', items: [DIPS] });

      expect(saved.name).toBe('Push Day B');
      expect(saved.items).toEqual([DIPS]);
      expect(yield* rows('SELECT DISTINCT item_id FROM routine_item_sets')).toEqual([{ item_id: 'rit_dips' }]);
      expect(saved.createdAt).toBe(NOW);
      expect(saved.updatedAt).toBe(NOW + 5_000);
    }),
    layer(),
  );

  itEffect(
    'fails with SqlError for an item whose exercise is not stored, and writes nothing',
    Effect.gen(function* () {
      const repo = yield* RoutineRepository;

      const result = yield* Effect.either(repo.save({ id: PUSH, name: 'Push Day', items: [aRoutineItem()] }));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(yield* repo.list).toEqual([]);
    }),
    layer(),
  );

  itEffect(
    'lists every routine, most recently changed first',
    Effect.gen(function* () {
      yield* savePushDay;
      yield* TestClock.setTime(NOW + 1_000);
      const repo = yield* RoutineRepository;
      yield* repo.save({ id: RoutineId.make('rtn_legs'), name: 'Legs', items: [DIPS] });

      const listed = yield* repo.list;

      expect(listed.map(routine => [routine.id, routine.items.length])).toEqual([
        ['rtn_legs', 1],
        ['rtn_push', 2],
      ]);
    }),
    layer(),
  );

  itEffect(
    'returns undefined for a routine that does not exist',
    Effect.gen(function* () {
      expect(yield* (yield* RoutineRepository).byId(RoutineId.make('rtn_gone'))).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'reads an item stored without a name as Unknown exercise',
    Effect.gen(function* () {
      yield* savePushDay;
      yield* run("UPDATE routine_items SET exercise_name = '' WHERE id = 'rit_bench'");

      const routine = yield* (yield* RoutineRepository).byId(PUSH);

      expect(routine?.items[0]?.exerciseName).toBe('Unknown exercise');
    }),
    layer(),
  );

  itEffect(
    'fails with DecodeError for a routine row of the wrong shape',
    Effect.gen(function* () {
      yield* savePushDay;
      yield* run("UPDATE routines SET times_completed = 'often' WHERE id = 'rtn_push'");

      const result = yield* Effect.either((yield* RoutineRepository).list);

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'DecodeError', source: 'routines' });
    }),
    layer(),
  );
});

describe('RoutineRepositoryLive edits', () => {
  itEffect(
    'keeps a second routine’s items apart from the first',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;
      yield* repo.save({
        id: RoutineId.make('rtn_legs'),
        name: 'Legs',
        items: [anotherRoutineItem({ id: 'rit_legs' })],
      });

      expect((yield* repo.byId(PUSH))?.items.map(item => item.id)).toEqual(['rit_bench', 'rit_press']);
    }),
    layer(),
  );

  itEffect(
    'renames a routine and stores a blank name as Untitled routine',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* repo.rename(PUSH, '  Chest  ');
      const renamed = yield* repo.byId(PUSH);
      yield* repo.rename(PUSH, ' ');

      expect(renamed?.name).toBe('Chest');
      expect((yield* repo.byId(PUSH))?.name).toBe('Untitled routine');
    }),
    layer(),
  );

  itEffect(
    'deletes a routine together with its items and their sets',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* repo.delete(PUSH);

      expect(yield* repo.byId(PUSH)).toBeUndefined();
      expect(yield* rows('SELECT id FROM routine_items')).toEqual([]);
      expect(yield* rows('SELECT item_id FROM routine_item_sets')).toEqual([]);
    }),
    layer(),
  );

  itEffect(
    'numbers the items in the order given and touches the routine',
    Effect.gen(function* () {
      yield* savePushDay;
      yield* TestClock.setTime(NOW + 2_000);
      const repo = yield* RoutineRepository;

      yield* repo.reorder(PUSH, ['rit_press', 'rit_bench']);

      const routine = yield* repo.byId(PUSH);
      expect(routine?.items.map(item => item.id)).toEqual(['rit_press', 'rit_bench']);
      expect(routine?.updatedAt).toBe(NOW + 2_000);
    }),
    layer(),
  );

  itEffect(
    'changes only the targets in the patch',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* repo.setItem('rit_bench', { restSeconds: 120 });

      expect((yield* repo.byId(PUSH))?.items[0]).toEqual(aRoutineItem({ restSeconds: 120 }));
    }),
    layer(),
  );

  itEffect(
    'replaces the item’s sets with the patch’s, each on its own targets, and keeps the other items’ sets',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;
      const sets = [
        { index: 0, reps: 12, weightKg: 50, targetRpe: null },
        { index: 1, reps: 10, weightKg: 62.5, targetRpe: 7.5 },
        { index: 2, reps: 8, weightKg: 0, targetRpe: 10 },
        { index: 3, reps: 6, weightKg: 70, targetRpe: 0 },
        { index: 4, reps: 1, weightKg: 100, targetRpe: 9 },
      ];

      yield* repo.setItem('rit_bench', { sets });

      const routine = yield* repo.byId(PUSH);
      expect(routine?.items[0]?.sets).toEqual(sets);
      expect(routine?.items[1]).toEqual(anotherRoutineItem());
      yield* repo.setItem('rit_bench', { sets: sets.slice(0, 1) });
      expect((yield* repo.byId(PUSH))?.items[0]?.sets).toEqual(sets.slice(0, 1));
    }),
    layer(),
  );

  itEffect(
    'clears a note set to null and leaves it when the patch has no note',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* repo.setItem('rit_press', { restSeconds: 45 });
      const kept = (yield* repo.byId(PUSH))?.items[1]?.notes;
      yield* repo.setItem('rit_press', { notes: null });

      expect(kept).toBe('Brace first');
      expect((yield* repo.byId(PUSH))?.items[1]?.notes).toBeNull();
    }),
    layer(),
  );

  itEffect(
    'changes nothing for an unknown item',
    Effect.gen(function* () {
      const saved = yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* repo.setItem('rit_gone', { sets: uniformSets(9, 8, 0) });

      expect(yield* repo.byId(PUSH)).toEqual(saved);
    }),
    layer(),
  );

  itEffect(
    'appends an added item after the last one',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* repo.addItem(PUSH, DIPS);

      expect((yield* repo.byId(PUSH))?.items.map(item => item.id)).toEqual(['rit_bench', 'rit_press', 'rit_dips']);
    }),
    layer(),
  );

  itEffect(
    'fails with SqlError when an added item names an exercise that is not stored, and adds nothing',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      const result = yield* Effect.either(
        repo.addItem(PUSH, aRoutineItem({ id: 'rit_row', exerciseId: 'ex:pullups' })),
      );

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect((yield* repo.byId(PUSH))?.items).toHaveLength(2);
    }),
    layer(),
  );

  itEffect(
    'removes an item and numbers the rest from 0',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;
      yield* repo.addItem(PUSH, DIPS);

      yield* repo.removeItem(PUSH, 'rit_bench');

      expect(yield* rows('SELECT id, position FROM routine_items ORDER BY position')).toEqual([
        { id: 'rit_press', position: 0 },
        { id: 'rit_dips', position: 1 },
      ]);
      expect(yield* rows("SELECT item_id FROM routine_item_sets WHERE item_id = 'rit_bench'")).toEqual([]);
    }),
    layer(),
  );

  itEffect(
    'counts a workout and keeps the latest performed time',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* repo.markUsed(PUSH, NOW + 10_000);
      yield* repo.markUsed(PUSH, NOW + 5_000);

      const routine = yield* repo.byId(PUSH);
      expect(routine?.timesCompleted).toBe(2);
      expect(routine?.lastPerformedAt).toBe(NOW + 10_000);
    }),
    layer(),
  );
});

describe('RoutineRepositoryLive replaceItems', () => {
  itEffect(
    'replaces the items and their sets in order, keeping the name and the trained count',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;
      yield* repo.markUsed(PUSH, NOW);
      yield* TestClock.setTime(NOW + 60_000);
      const press = anotherRoutineItem({ sets: [{ index: 0, reps: 5, weightKg: 45, targetRpe: 8 }] });

      yield* repo.replaceItems(PUSH, [press, DIPS]);

      const routine = yield* repo.byId(PUSH);
      expect(routine?.name).toBe('Push Day');
      expect(routine?.timesCompleted).toBe(1);
      expect(routine?.updatedAt).toBe(NOW + 60_000);
      expect(routine?.items).toEqual([press, DIPS]);
      const orphans = yield* rows<{ n: number }>(
        "SELECT COUNT(*) AS n FROM routine_item_sets WHERE item_id = 'rit_bench'",
      );
      expect(orphans[0]?.n).toBe(0);
    }),
    layer(),
  );

  itEffect(
    'joins a transaction the caller holds, so a rollback undoes it',
    Effect.gen(function* () {
      const before = yield* savePushDay;
      const repo = yield* RoutineRepository;

      yield* run('BEGIN');
      yield* repo.replaceItems(PUSH, [DIPS]);
      yield* run('ROLLBACK');

      expect((yield* repo.byId(PUSH))?.items).toEqual(before.items);
    }),
    layer(),
  );

  itEffect(
    'announces the change',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      const events = yield* published(repo.replaceItems(PUSH, [DIPS]));

      expect(events).toEqual([{ routineId: PUSH, kind: 'itemsChanged' }]);
    }),
    layer(),
  );
});

describe('RoutineRepositoryLive change events', () => {
  itEffect(
    'publishes RoutineChanged on save, rename, delete and reorder',
    Effect.gen(function* () {
      yield* storeExercises;
      const repo = yield* RoutineRepository;
      const push = aRoutine();

      const events = yield* published(
        Effect.gen(function* () {
          yield* repo.save({ id: push.id, name: push.name, items: push.items });
          yield* repo.rename(PUSH, 'Chest');
          yield* repo.reorder(PUSH, ['rit_press', 'rit_bench']);
          yield* repo.delete(PUSH);
        }),
      );

      expect(events).toEqual([
        { routineId: PUSH, kind: 'saved' },
        { routineId: PUSH, kind: 'renamed' },
        { routineId: PUSH, kind: 'reordered' },
        { routineId: PUSH, kind: 'deleted' },
      ]);
    }),
    layer(),
  );

  itEffect(
    'publishes RoutineChanged when an item is changed, added or removed, and when a workout counts',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      const events = yield* published(
        Effect.gen(function* () {
          yield* repo.setItem('rit_bench', { sets: uniformSets(4, 8, 60) });
          yield* repo.addItem(PUSH, DIPS);
          yield* repo.removeItem(PUSH, 'rit_dips');
          yield* repo.markUsed(PUSH, NOW);
        }),
      );

      expect(events.map(event => event.kind)).toEqual(['itemsChanged', 'itemsChanged', 'itemsChanged', 'used']);
    }),
    layer(),
  );

  itEffect(
    'publishes nothing when a save fails',
    Effect.gen(function* () {
      const repo = yield* RoutineRepository;

      const events = yield* published(
        Effect.either(repo.save({ id: PUSH, name: 'Push Day', items: [aRoutineItem()] })),
      );

      expect(events).toEqual([]);
    }),
    layer(),
  );

  itEffect(
    'publishes nothing for a change to an unknown item',
    Effect.gen(function* () {
      yield* savePushDay;
      const repo = yield* RoutineRepository;

      const events = yield* published(repo.setItem('rit_gone', { sets: uniformSets(2, 8, 60) }));

      expect(events).toEqual([]);
    }),
    layer(),
  );
});
