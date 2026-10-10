import { runMigrations } from '@timothyrusso/effect-core';
import { Effect, Layer } from 'effect';
import { migrations, SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeNodeSqliteLayer } from '@/features/core/testing';
import { anEntry } from '@/features/workouts/__fixtures__/builders';
import { ActivityRepositoryLive } from '@/features/workouts/data/repositories/activityRepositoryLive';
import { RecordRepositoryLive } from '@/features/workouts/data/repositories/recordRepositoryLive';
import { SessionRepositoryLive } from '@/features/workouts/data/repositories/sessionRepositoryLive';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';

/** Entries as builds before tracking types wrote them: no `trackingType`, no `type` on a set. */
const LEGACY_ENTRIES = JSON.stringify([
  {
    exerciseId: 'ex:barbell-bench-press',
    exerciseName: 'Bench Press',
    sets: [{ index: 0, reps: 8, weightKg: 60, completed: true, estimated1rm: 76, rpe: null }],
    notes: null,
    restSeconds: 90,
  },
]);

const insertWorkout = (id: string, entries: string) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() =>
      db.runAsync(
        `INSERT INTO activities (id, kind, title, started_at, duration_seconds, source_session_id, entries_json,
           volume_kg, total_sets, created_at)
         VALUES (?, 'lift', 'Push Day', 1, 2700, ?, ?, 480, 1, 1)`,
        [id, id, entries],
      ),
    ),
  );

/**
 * A database a v12 build left behind, holding a workout, an open session and records written
 * before tracking types, then migrated to the last version as the next launch does.
 */
const legacyDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    yield* runMigrations(
      db,
      migrations.filter(migration => migration.version <= 12),
    );
    yield* insertWorkout('session-legacy', LEGACY_ENTRIES);
    yield* Effect.promise(() =>
      db.runAsync(
        `INSERT INTO sessions (id, routine_id, routine_name, started_at, elapsed_seconds, status, entries_json,
           active_index, updated_at)
         VALUES ('session-open', NULL, 'Push Day', 1, 600, 'active', ?, 0, 1)`,
        [LEGACY_ENTRIES],
      ),
    );
    yield* Effect.promise(() =>
      db.execAsync(`
        INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
          VALUES ('ex:barbell-bench-press', 'est1rm', 'Bench Press', 76, 1);
      `),
    );
    yield* runMigrations(db, migrations);
  }),
);

const layer = () =>
  Layer.mergeAll(ActivityRepositoryLive, RecordRepositoryLive, SessionRepositoryLive).pipe(
    Layer.provideMerge(legacyDatabase),
    Layer.provideMerge(makeNodeSqliteLayer()),
  );

describe('rows written before tracking types', () => {
  itEffect(
    'are gone once v13 ran: no workout, no open session and no record is left to read',
    Effect.gen(function* () {
      expect(yield* (yield* ActivityRepository).list()).toEqual([]);
      expect(yield* (yield* SessionRepository).active).toBeUndefined();
      expect(yield* (yield* RecordRepository).forExercise('ex:barbell-bench-press')).toEqual([]);
    }),
    layer(),
  );

  itEffect(
    'are not read as weight and reps any more: an entry without its tracking type is dropped, keeping the rest',
    Effect.gen(function* () {
      const typed = anEntry();
      const entries = JSON.stringify([...JSON.parse(LEGACY_ENTRIES), typed]);
      yield* insertWorkout('session-mixed', entries);

      const workout = yield* (yield* ActivityRepository).byId(ActivityId.make('session-mixed'));

      expect(workout?.strength?.entries).toEqual([typed]);
    }),
    layer(),
  );

  itEffect(
    'leave out a record kind this build does not know',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      yield* Effect.promise(() =>
        db.execAsync(`
          INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
            VALUES ('ex:barbell-bench-press', 'est1rm', 'Bench Press', 76, 1);
          INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
            VALUES ('ex:barbell-bench-press', 'tonnage', 'Bench Press', 480, 1);
        `),
      );

      const records = yield* (yield* RecordRepository).forExercise('ex:barbell-bench-press');

      expect(records.map(record => [record.kind, record.value])).toEqual([['est1rm', 76]]);
    }),
    layer(),
  );
});
