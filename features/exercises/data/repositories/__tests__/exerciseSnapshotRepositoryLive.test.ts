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

/** A copy the previous catalog stored: a numeric external id, prose instructions and a URL image. */
const LEGACY_ROW = {
  id: 'legacy:10',
  external_id: 10,
  name: 'Bench Press',
  instructions: 'Lower the bar to the chest.',
  category: 'Chest',
  primary_muscles: '["Chest"]',
  secondary_muscles: '["Triceps brachii"]',
  equipment: '["Barbell"]',
  image_url: 'https://example.com/big.png',
  thumbnail_url: null,
  source: 'remote',
  captured_at: 1_700_000_000_000,
};

describe('ExerciseSnapshotRepositoryLive', () => {
  itEffect(
    'reads a copy the previous catalog stored, its prose as one step and the thumbnail falling back to the image',
    Effect.gen(function* () {
      yield* store(LEGACY_ROW);

      expect(yield* (yield* ExerciseSnapshotRepository).byId('legacy:10')).toEqual({
        exerciseId: 'legacy:10',
        name: 'Bench Press',
        instructions: ['Lower the bar to the chest.'],
        category: 'Chest',
        primaryMuscles: ['Chest'],
        secondaryMuscles: ['Triceps brachii'],
        equipment: ['Barbell'],
        imageUrl: 'https://example.com/big.png',
        thumbnailUrl: 'https://example.com/big.png',
        capturedAt: 1_700_000_000_000,
      });
    }),
    layer(),
  );

  itEffect(
    'reads a list column that does not parse as empty, and drops values that are not names',
    Effect.gen(function* () {
      yield* store({ ...LEGACY_ROW, primary_muscles: '{broken', equipment: '["Barbell", 3, null]' });

      const snapshot = yield* (yield* ExerciseSnapshotRepository).byId('legacy:10');

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
      yield* store({ ...LEGACY_ROW, captured_at: 'yesterday' });

      const result = yield* Effect.either((yield* ExerciseSnapshotRepository).byId('legacy:10'));

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'DecodeError', source: 'exercises' });
    }),
    layer(),
  );

  itEffect(
    'reads several stored exercises by id and leaves out the ones nothing has stored',
    Effect.gen(function* () {
      yield* store(LEGACY_ROW);
      yield* store({ ...LEGACY_ROW, id: 'local:hip-thrust', external_id: null, name: 'Hip Thrust', source: 'local' });

      const found = yield* (yield* ExerciseSnapshotRepository).byIds(['legacy:10', 'local:hip-thrust', 'ex:dips']);

      expect([...found.keys()].sort()).toEqual(['legacy:10', 'local:hip-thrust']);
      expect(found.get('local:hip-thrust')?.name).toBe('Hip Thrust');
    }),
    layer(),
  );

  itEffect(
    'reads nothing for an empty list of ids',
    Effect.gen(function* () {
      yield* store(LEGACY_ROW);

      expect((yield* (yield* ExerciseSnapshotRepository).byIds([])).size).toBe(0);
    }),
    layer(),
  );

  itEffect(
    'finds the most recently stored exercise with a name, ignoring case and surrounding spaces',
    Effect.gen(function* () {
      yield* store(LEGACY_ROW);
      yield* store({ ...LEGACY_ROW, id: 'local:bench', external_id: null, captured_at: 1_800_000_000_000 });

      const found = yield* (yield* ExerciseSnapshotRepository).byName('  bench PRESS ');

      expect(found?.exerciseId).toBe('local:bench');
    }),
    layer(),
  );

  itEffect(
    'returns undefined for a name nothing has stored',
    Effect.gen(function* () {
      yield* store(LEGACY_ROW);

      expect(yield* (yield* ExerciseSnapshotRepository).byName('Squat')).toBeUndefined();
    }),
    layer(),
  );

  itEffect(
    'stores a snapshot and reads it back unchanged',
    Effect.gen(function* () {
      const repo = yield* ExerciseSnapshotRepository;

      yield* repo.upsert(aSnapshot());

      expect(yield* repo.byId('ex:barbell-bench-press')).toEqual(aSnapshot());
    }),
    layer(),
  );

  itEffect(
    'stores the steps as a JSON list and the images as asset paths, never as bundled module numbers',
    Effect.gen(function* () {
      yield* (yield* ExerciseSnapshotRepository).upsert(aSnapshot());

      const db = yield* SqliteClient;
      const row = yield* Effect.promise(() =>
        db.getFirstAsync<{ instructions: string; image_url: unknown; thumbnail_url: unknown; external_id: unknown }>(
          'SELECT instructions, image_url, thumbnail_url, external_id FROM exercises',
        ),
      );
      expect(row).toEqual({
        instructions: '["Lower the bar to the chest.","Press."]',
        image_url: 'assets/catalog/images/barbell-bench-press/0.webp',
        thumbnail_url: 'assets/catalog/images/barbell-bench-press/thumb.webp',
        external_id: null,
      });
    }),
    layer(),
  );

  itEffect(
    'labels a local snapshot as local and a catalog one as remote',
    Effect.gen(function* () {
      const repo = yield* ExerciseSnapshotRepository;

      yield* repo.upsert(aSnapshot());
      yield* repo.upsert(aSnapshot({ exerciseId: 'local:hip-thrust' }));

      const db = yield* SqliteClient;
      const rows = yield* Effect.promise(() =>
        db.getAllAsync<{ id: string; source: string }>('SELECT id, source FROM exercises ORDER BY id'),
      );
      expect(rows).toEqual([
        { id: 'ex:barbell-bench-press', source: 'remote' },
        { id: 'local:hip-thrust', source: 'local' },
      ]);
    }),
    layer(),
  );

  itEffect(
    'replaces a stored copy but keeps its images when the new copy has none',
    Effect.gen(function* () {
      const repo = yield* ExerciseSnapshotRepository;
      yield* repo.upsert(aSnapshot());

      yield* repo.upsert(aSnapshot({ name: 'Bench Press', imageUrl: null, thumbnailUrl: null, capturedAt: 2 }));

      expect(yield* repo.byId('ex:barbell-bench-press')).toMatchObject({
        name: 'Bench Press',
        imageUrl: 'assets/catalog/images/barbell-bench-press/0.webp',
        thumbnailUrl: 'assets/catalog/images/barbell-bench-press/thumb.webp',
        capturedAt: 2,
      });
    }),
    layer(),
  );
});

const aSnapshot = (overrides: Partial<ExerciseSnapshot> = {}): ExerciseSnapshot => ({
  exerciseId: 'ex:barbell-bench-press',
  name: 'Barbell Bench Press',
  instructions: ['Lower the bar to the chest.', 'Press.'],
  category: 'Chest',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps'],
  equipment: ['Barbell'],
  imageUrl: 'assets/catalog/images/barbell-bench-press/0.webp',
  thumbnailUrl: 'assets/catalog/images/barbell-bench-press/thumb.webp',
  capturedAt: 1_700_000_000_000,
  ...overrides,
});
