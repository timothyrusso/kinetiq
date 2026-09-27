import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aCatalogMeta, anExercise } from '@/features/exercises/__fixtures__/builders';
import { makeCatalogRepositoryFake } from '@/features/exercises/useCases/__tests__/catalogFakes';
import { getCatalogMeta } from '@/features/exercises/useCases/getCatalogMeta';
import { getExercise } from '@/features/exercises/useCases/getExercise';
import { getTaxonomy } from '@/features/exercises/useCases/getTaxonomy';
import { getVariations } from '@/features/exercises/useCases/getVariations';
import { searchExercises } from '@/features/exercises/useCases/searchExercises';

const ALL = { query: '', categoryId: null, equipmentId: null, muscleId: null };
const bench = anExercise();
const squat = anExercise({ id: 'wger:13', externalId: 13, name: 'Squat', category: 'Legs' });
const rows = Array.from({ length: 5 }, (_, i) =>
  anExercise({ id: `wger:${100 + i}`, externalId: 100 + i, name: `Press ${i}` }),
);
const catalog = makeCatalogRepositoryFake({ exercises: [bench, squat, ...rows], meta: aCatalogMeta() });

describe('searchExercises', () => {
  itEffect(
    'returns a page with the filtered total and where the next page starts',
    Effect.gen(function* () {
      expect(yield* searchExercises({ ...ALL, query: 'press' }, 'en', 0, 4)).toEqual({
        items: [bench, ...rows.slice(0, 3)],
        total: 6,
        nextOffset: 4,
      });
    }),
    catalog,
  );

  itEffect(
    'has no next page once a page reaches the total',
    Effect.gen(function* () {
      expect((yield* searchExercises({ ...ALL, query: 'press' }, 'en', 4, 4)).nextOffset).toBeNull();
    }),
    catalog,
  );

  itEffect(
    'has no next page when a page comes back empty',
    Effect.gen(function* () {
      expect(yield* searchExercises({ ...ALL, query: 'row' }, 'en')).toEqual({ items: [], total: 0, nextOffset: null });
    }),
    catalog,
  );
});

describe('getExercise', () => {
  itEffect(
    'returns the catalog row for a catalog id',
    Effect.gen(function* () {
      expect(yield* getExercise('wger:13', 'en')).toEqual(squat);
    }),
    catalog,
  );

  itEffect(
    'fails with ExerciseNotFound for an id the catalog does not have',
    Effect.gen(function* () {
      const result = yield* Effect.either(getExercise('wger:999', 'en'));

      expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'ExerciseNotFound', exerciseId: 'wger:999' });
    }),
    catalog,
  );

  itEffect(
    'fails with ExerciseNotFound for a local id, which the catalog cannot have',
    Effect.gen(function* () {
      const result = yield* Effect.either(getExercise('local:bench-press', 'en'));

      expect(Either.isLeft(result) && result.left._tag).toBe('ExerciseNotFound');
    }),
    catalog,
  );
});

describe('getVariations', () => {
  itEffect(
    'returns the family of a catalog exercise',
    Effect.gen(function* () {
      expect((yield* getVariations('wger:13', 'en')).map(exercise => exercise.id)).not.toContain('wger:13');
    }),
    catalog,
  );

  itEffect(
    'returns nothing for a local id',
    Effect.gen(function* () {
      expect(yield* getVariations('local:bench-press', 'en')).toEqual([]);
    }),
    catalog,
  );
});

describe('getTaxonomy and getCatalogMeta', () => {
  itEffect(
    'read the repository as it is',
    Effect.gen(function* () {
      expect((yield* getTaxonomy).categories).toEqual([{ id: 1, name: 'Chest' }]);
      expect(yield* getCatalogMeta).toEqual(aCatalogMeta());
    }),
    catalog,
  );
});
