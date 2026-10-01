import { Effect, Layer } from 'effect';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

/** The catalog installed from the committed dataset, read the way the picker reads it. */
const layer = () =>
  Layer.mergeAll(CatalogRepositoryLive, BundledCatalogSourceLive).pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const ALL: ExerciseFilter = { query: '', bodyArea: null, equipment: null, muscle: null };

const installed = Effect.gen(function* () {
  const repository = yield* CatalogRepository;
  const payload = yield* (yield* BundledCatalog).load;
  yield* repository.replaceCatalog(payload, 1);
  return { repository, payload };
});

describe('CatalogRepositoryLive over the bundled dataset', () => {
  itEffect(
    'installs whole: every exercise listed in both languages',
    Effect.gen(function* () {
      const { repository, payload } = yield* installed;

      expect((yield* repository.readMeta).exerciseCount).toBe(payload.exercises.length);
      expect((yield* repository.page(ALL, 'en', 0, 1)).total).toBe(payload.exercises.length);
      expect((yield* repository.page(ALL, 'it', 0, 1)).total).toBe(payload.exercises.length);
    }),
    layer(),
  );

  itEffect(
    'finds bench presses at the top for "panca" in Italian, and among the first names starting "bench" in English',
    Effect.gen(function* () {
      const { repository } = yield* installed;

      const italian = yield* repository.page({ ...ALL, query: 'panca' }, 'it', 0, 5);
      // NOTE: "Bench Dips" and "Bench Jump" also start with "bench", and name order puts them
      // first; the ranking is the one the picker has always had.
      const english = yield* repository.page({ ...ALL, query: 'bench' }, 'en', 0, 6);

      for (const exercise of italian.items) expect(exercise.id).toMatch(/press/);
      expect(english.items.filter(exercise => exercise.id.includes('bench-press')).length).toBeGreaterThanOrEqual(3);
      for (const exercise of english.items) expect(exercise.name.toLowerCase().startsWith('bench')).toBe(true);
    }),
    layer(),
  );

  itEffect(
    'filters by every muscle and every piece of equipment the filters offer, each named in the app catalog',
    Effect.gen(function* () {
      const { repository } = yield* installed;
      const taxonomy = yield* repository.taxonomy('it');

      expect(taxonomy.muscles.length).toBeGreaterThan(10);
      for (const muscle of taxonomy.muscles) {
        expect(muscle.name).not.toBe(muscle.id);
        expect((yield* repository.page({ ...ALL, muscle: muscle.id }, 'it', 0, 1)).total).toBeGreaterThan(0);
      }
      for (const piece of taxonomy.equipment) {
        expect(piece.name).not.toBe(piece.id);
        expect((yield* repository.page({ ...ALL, equipment: piece.id }, 'it', 0, 1)).total).toBeGreaterThan(0);
      }
    }),
    layer(),
  );
});
