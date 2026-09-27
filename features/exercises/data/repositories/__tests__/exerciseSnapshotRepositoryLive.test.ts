import { Effect, Either, Layer } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { ExerciseSnapshotRepositoryLive } from '@/features/exercises/data/repositories/exerciseSnapshotRepositoryLive';
import { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';

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

  itEffect(
    'reads several stored exercises by id and leaves out the ones nothing has stored',
    Effect.gen(function* () {
      yield* store(BENCH_ROW);
      yield* store({ ...BENCH_ROW, id: 'local:hip-thrust', external_id: null, name: 'Hip Thrust', source: 'local' });

      const found = yield* (yield* ExerciseSnapshotRepository).byIds(['wger:10', 'local:hip-thrust', 'wger:99']);

      expect([...found.keys()].sort()).toEqual(['local:hip-thrust', 'wger:10']);
      expect(found.get('local:hip-thrust')?.name).toBe('Hip Thrust');
    }),
    layer(),
  );

  itEffect(
    'reads nothing for an empty list of ids',
    Effect.gen(function* () {
      yield* store(BENCH_ROW);

      expect((yield* (yield* ExerciseSnapshotRepository).byIds([])).size).toBe(0);
    }),
    layer(),
  );

  itEffect(
    'finds the most recently stored exercise with a name, ignoring case and surrounding spaces',
    Effect.gen(function* () {
      yield* store(BENCH_ROW);
      yield* store({ ...BENCH_ROW, id: 'local:bench', external_id: null, captured_at: 1_800_000_000_000 });

      const found = yield* (yield* ExerciseSnapshotRepository).byName('  bench PRESS ');

      expect(found?.exerciseId).toBe('local:bench');
    }),
    layer(),
  );

  itEffect(
    'returns undefined for a name nothing has stored',
    Effect.gen(function* () {
      yield* store(BENCH_ROW);

      expect(yield* (yield* ExerciseSnapshotRepository).byName('Squat')).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'stores a snapshot and reads it back unchanged',
    Effect.gen(function* () {
      const repo = yield* ExerciseSnapshotRepository;

      yield* repo.upsert(aSnapshot());

      expect(yield* repo.byId('wger:10')).toEqual(aSnapshot());
    }),
    layer(),
  );

  itEffect(
    'labels a snapshot with no wger id as local and one with an id as remote',
    Effect.gen(function* () {
      const repo = yield* ExerciseSnapshotRepository;

      yield* repo.upsert(aSnapshot());
      yield* repo.upsert(aSnapshot({ exerciseId: 'local:hip-thrust', externalId: null }));

      const db = yield* SqliteClient;
      const rows = yield* Effect.promise(() =>
        db.getAllAsync<{ id: string; source: string }>('SELECT id, source FROM exercises ORDER BY id'),
      );
      expect(rows).toEqual([
        { id: 'local:hip-thrust', source: 'local' },
        { id: 'wger:10', source: 'remote' },
      ]);
    }),
    layer(),
  );

  itEffect(
    'replaces a stored copy but keeps its images when the new copy has none',
    Effect.gen(function* () {
      const repo = yield* ExerciseSnapshotRepository;
      yield* repo.upsert(aSnapshot({ imageUrl: 'big.png', thumbnailUrl: 'small.png' }));

      yield* repo.upsert(aSnapshot({ name: 'Barbell Bench Press', imageUrl: null, thumbnailUrl: null, capturedAt: 2 }));

      expect(yield* repo.byId('wger:10')).toMatchObject({
        name: 'Barbell Bench Press',
        imageUrl: 'big.png',
        thumbnailUrl: 'small.png',
        capturedAt: 2,
      });
    }),
    layer(),
  );
});

const aSnapshot = (overrides: Partial<ExerciseSnapshot> = {}): ExerciseSnapshot => ({
  exerciseId: 'wger:10',
  name: 'Bench Press',
  instructions: 'Lower the bar to the chest.',
  category: 'Chest',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps brachii'],
  equipment: ['Barbell'],
  imageUrl: 'big.png',
  thumbnailUrl: 'small.png',
  externalId: 10,
  capturedAt: 1_700_000_000_000,
  ...overrides,
});
