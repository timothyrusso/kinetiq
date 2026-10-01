import { runMigrations } from '@timothyrusso/effect-core';
import { Effect, Layer } from 'effect';
import { migrations, SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeNodeSqliteLayer } from '@/features/core/testing';
import { ActivityRepositoryLive } from '@/features/workouts/data/repositories/activityRepositoryLive';
import { RecordRepositoryLive } from '@/features/workouts/data/repositories/recordRepositoryLive';
import { SessionRepositoryLive } from '@/features/workouts/data/repositories/sessionRepositoryLive';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';

/**
 * Entries as older builds wrote them: `JSON.stringify` dropped the nullable fields left
 * `undefined`, the first entry has no rest and a set with no `completed`, and the last one lost
 * its exercise id to a damaged write.
 */
const LEGACY_ENTRIES = JSON.stringify([
  {
    exerciseId: 'ex:barbell-bench-press',
    exerciseName: 'Bench Press',
    sets: [{ index: 0, reps: 8, weightKg: 60 }],
  },
  {
    exerciseId: 'ex:barbell-squat',
    exerciseName: 'Overhead Press',
    muscleGroup: 'Shoulders',
    sets: [{ index: 0, reps: 10, weightKg: 30, completed: true, estimated1rm: 40, rpe: 8 }],
    notes: 'Strict',
    restSeconds: 120,
  },
  { exerciseName: 'Mystery', sets: [] },
]);

/**
 * A database a v9 build of `main` left behind, holding a workout, an open session and records
 * written with those entries and a record kind this build does not know, then migrated to the
 * last version as the next launch does.
 */
const legacyDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    yield* runMigrations(
      db,
      migrations.filter(migration => migration.version <= 9),
    );
    yield* Effect.promise(() =>
      db.runAsync(
        `INSERT INTO activities (id, kind, title, started_at, duration_seconds, calories_kcal, seeded,
           source_session_id, entries_json, volume_kg, total_sets, created_at)
         VALUES ('session-legacy', 'lift', 'Push Day', 1, 2700, 278, 0, 'session-legacy', ?, 780, NULL, 1)`,
        [LEGACY_ENTRIES],
      ),
    );
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
        INSERT INTO app_state (key, value_json) VALUES ('session.active', '"session-open"');
        INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
          VALUES ('ex:barbell-bench-press', 'est1rm', 'Bench Press', 76, 1);
        INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
          VALUES ('ex:barbell-bench-press', 'tonnage', 'Bench Press', 480, 1);
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

describe('rows written by a v9 build', () => {
  itEffect(
    'read a legacy workout with the fields it lacks filled and only the unreadable entry dropped',
    Effect.gen(function* () {
      const workout = yield* (yield* ActivityRepository).byId(ActivityId.make('session-legacy'));

      expect(workout?.strength?.entries).toEqual([
        {
          exerciseId: 'ex:barbell-bench-press',
          exerciseName: 'Bench Press',
          muscleGroup: null,
          sets: [{ index: 0, reps: 8, weightKg: 60, completed: false, estimated1rm: null, rpe: null }],
          notes: null,
          restSeconds: 90,
        },
        {
          exerciseId: 'ex:barbell-squat',
          exerciseName: 'Overhead Press',
          muscleGroup: 'Shoulders',
          sets: [{ index: 0, reps: 10, weightKg: 30, completed: true, estimated1rm: 40, rpe: 8 }],
          notes: 'Strict',
          restSeconds: 120,
        },
      ]);
    }),
    layer(),
  );

  itEffect(
    'restore a legacy open session with its readable entries',
    Effect.gen(function* () {
      const session = yield* (yield* SessionRepository).active;

      expect(session?.entries.map(entry => entry.exerciseName)).toEqual(['Bench Press', 'Overhead Press']);
    }),
    layer(),
  );

  itEffect(
    'read the known records and leave out a kind this build does not know',
    Effect.gen(function* () {
      const records = yield* (yield* RecordRepository).forExercise('ex:barbell-bench-press');

      expect(records.map(record => [record.kind, record.value])).toEqual([['est1rm', 76]]);
    }),
    layer(),
  );
});
