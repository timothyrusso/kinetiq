import { Effect, Layer, TestClock } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { anEntry, aSession, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { SessionRepositoryLive } from '@/features/workouts/data/repositories/sessionRepositoryLive';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';

const layer = () => SessionRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const ID = ActivityId.make('session-mbz1a2b3');
const OTHER = ActivityId.make('session-older');

const run = (sql: string, params: (string | number | null)[] = []) =>
  Effect.flatMap(SqliteClient, db => Effect.promise(() => db.runAsync(sql, params)));

describe('SessionRepositoryLive', () => {
  itEffect(
    'saves a session and reads it back whole',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;

      yield* repository.save(
        aSession({ restEndsAt: WORKOUT_TIME + 90_000, restDurationSeconds: 90, notes: 'Heavy day' }),
      );

      expect(yield* repository.byId(ID)).toEqual(
        aSession({ restEndsAt: WORKOUT_TIME + 90_000, restDurationSeconds: 90, notes: 'Heavy day' }),
      );
    }),
    layer(),
  );

  itEffect(
    'reads back the routine items a session started with, and the item and row of each entry and set',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      const fromRoutine = aSession({
        routineItemIds: ['rit_bench', 'rit_gone'],
        entries: [anEntry({ routineItemId: 'rit_bench', sets: [aSet({ routineSetIndex: 0 }), aSet({ index: 1 })] })],
      });

      yield* repository.save(fromRoutine);

      expect(yield* repository.byId(ID)).toEqual(fromRoutine);
    }),
    layer(),
  );

  itEffect(
    'stores a session not from a routine as the plain list of its entries, as before',
    Effect.gen(function* () {
      yield* (yield* SessionRepository).save(aSession({ routineId: null }));

      const [row] = yield* Effect.flatMap(SqliteClient, db =>
        Effect.promise(() => db.getAllAsync<{ entries_json: string }>('SELECT entries_json FROM sessions')),
      );
      expect(JSON.parse(row?.entries_json ?? 'null')).toEqual(aSession().entries);
    }),
    layer(),
  );

  itEffect(
    'replaces the stored row on a second save of the same session',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      yield* repository.save(aSession());

      yield* repository.save(aSession({ elapsedSeconds: 900, activeIndex: 1 }));

      expect(yield* repository.byId(ID)).toMatchObject({ elapsedSeconds: 900, activeIndex: 1 });
    }),
    layer(),
  );

  itEffect(
    'offers the most recently changed active or paused session to restore',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      yield* repository.save(aSession({ id: OTHER, status: 'paused', updatedAt: 1 }));
      yield* repository.save(aSession());

      expect((yield* repository.active)?.id).toBe(ID);
    }),
    layer(),
  );

  itEffect(
    'never offers a finished or discarded session',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      yield* repository.save(aSession({ status: 'finished' }));
      yield* repository.save(aSession({ id: OTHER, status: 'discarded' }));

      expect(yield* repository.active).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'clears the rest and stamps the row with the time',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      yield* repository.save(aSession({ restEndsAt: WORKOUT_TIME + 90_000, restDurationSeconds: 90 }));
      yield* TestClock.setTime(WORKOUT_TIME + 700_000);

      yield* repository.clearRest(ID);

      expect(yield* repository.byId(ID)).toMatchObject({
        restEndsAt: null,
        restDurationSeconds: null,
        updatedAt: WORKOUT_TIME + 700_000,
        elapsedSeconds: 600,
      });
    }),
    layer(),
  );

  itEffect(
    'marks a session finished, after which it is not restored',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      yield* repository.save(aSession());

      yield* repository.setStatus(ID, 'finished');

      expect((yield* repository.byId(ID))?.status).toBe('finished');
      expect(yield* repository.active).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'deletes a discarded session outright',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      yield* repository.save(aSession());

      yield* repository.remove(ID);

      expect(yield* repository.byId(ID)).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'reads a status the app does not know as active, so the workout is restored',
    Effect.gen(function* () {
      const repository = yield* SessionRepository;
      yield* repository.save(aSession());
      yield* run(`UPDATE sessions SET status = 'running' WHERE id = ?`, [ID]);

      expect((yield* repository.byId(ID))?.status).toBe('active');
    }),
    layer(),
  );
});
