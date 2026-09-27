import { Effect, Either, Layer } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { ExerciseSnapshotRepositoryLive } from '@/features/exercises/data/repositories/exerciseSnapshotRepositoryLive';
import { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';

const layer = () => ExerciseSnapshotRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const store = (values: Record<string, string | number | null>) =>
  Effect.flatMap(SqliteClient, db => {
    const columns = Object.keys(values);
    return Effect.promise(() =>
      db.runAsync(
        `INSERT INTO exercises (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        Object.values(values),
      ),
    );
  });

const BENCH_ROW = {
  id: 'wger:10',
  external_id: 10,
  name: 'Bench Press',
  instructions: 'Lower the bar to the chest.',
  category: 'Chest',
  primary_muscles: '["Chest"]',
  secondary_muscles: '["Triceps brachii"]',
  equipment: '["Barbell"]',
  image_url: 'big.png',
  thumbnail_url: null,
  source: 'remote',
  captured_at: 1_700_000_000_000,
};

describe('ExerciseSnapshotRepositoryLive', () => {
  itEffect(
    'reads a stored exercise back as its snapshot, the thumbnail falling back to the image',
    Effect.gen(function* () {
      yield* store(BENCH_ROW);

      expect(yield* (yield* ExerciseSnapshotRepository).byId('wger:10')).toEqual({
        exerciseId: 'wger:10',
        name: 'Bench Press',
        instructions: 'Lower the bar to the chest.',
        category: 'Chest',
        primaryMuscles: ['Chest'],
        secondaryMuscles: ['Triceps brachii'],
        equipment: ['Barbell'],
        imageUrl: 'big.png',
        thumbnailUrl: 'big.png',
        externalId: 10,
        capturedAt: 1_700_000_000_000,
      });
    }),
    layer(),
  );

  itEffect(
    'reads a list column that does not parse as empty, and drops values that are not names',
    Effect.gen(function* () {
      yield* store({ ...BENCH_ROW, primary_muscles: '{broken', equipment: '["Barbell", 3, null]' });

      const snapshot = yield* (yield* ExerciseSnapshotRepository).byId('wger:10');

      expect(snapshot?.primaryMuscles).toEqual([]);
      expect(snapshot?.equipment).toEqual(['Barbell']);
    }),
    layer(),
  );

  itEffect(
    'returns undefined for an exercise nothing has stored',
    Effect.gen(function* () {
      expect(yield* (yield* ExerciseSnapshotRepository).byId('local:bench-press')).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'fails with DecodeError for a row of the wrong shape',
    Effect.gen(function* () {
      yield* store({ ...BENCH_ROW, captured_at: 'yesterday' });

      const result = yield* Effect.either((yield* ExerciseSnapshotRepository).byId('wger:10'));

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'DecodeError', source: 'exercises' });
    }),
    layer(),
  );
});
