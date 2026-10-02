import { Effect } from 'effect';
import { itEffect } from '@/features/core/testing';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { makeCatalogRepositoryFake } from '@/features/exercises/useCases/__tests__/catalogFakes';
import { getExercise } from '@/features/exercises/useCases/getExercise';
import { getSimilarExercises } from '@/features/exercises/useCases/getSimilarExercises';
import { getTaxonomy } from '@/features/exercises/useCases/getTaxonomy';
import { searchExercises } from '@/features/exercises/useCases/searchExercises';

const ALL = { query: '', bodyArea: null, equipment: null, muscle: null };
const bench = anExercise();
const squat = anExercise({ id: 'ex:barbell-squat', name: 'Squat', category: 'Legs' });
const rows = Array.from({ length: 5 }, (_, i) => anExercise({ id: `ex:press-${i}`, name: `Press ${i}` }));
const catalog = makeCatalogRepositoryFake({ exercises: [bench, squat, ...rows] });

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
      expect(yield* getExercise('ex:barbell-squat', 'en')).toEqual(squat);
    }),
    catalog,
  );

  itEffect(
    'answers null, without failing, for an id the catalog does not have',
    Effect.gen(function* () {
      expect(yield* getExercise('ex:no-such-exercise', 'en')).toBeNull();
    }),
    catalog,
  );

  itEffect(
    'answers null for a local id or an id from the previous catalog, which the catalog cannot have',
    Effect.gen(function* () {
      expect(yield* getExercise('local:bench-press', 'en')).toBeNull();
      expect(yield* getExercise('legacy:13', 'en')).toBeNull();
    }),
    catalog,
  );
});

describe('getSimilarExercises', () => {
  itEffect(
    'returns the exercises like a catalog exercise, never the exercise itself',
    Effect.gen(function* () {
      expect((yield* getSimilarExercises('ex:barbell-squat', 'en')).map(exercise => exercise.id)).not.toContain(
        'ex:barbell-squat',
      );
    }),
    catalog,
  );

  itEffect(
    'returns nothing for a local id',
    Effect.gen(function* () {
      expect(yield* getSimilarExercises('local:bench-press', 'en')).toEqual([]);
    }),
    catalog,
  );
});

describe('getTaxonomy', () => {
  itEffect(
    'reads the repository as it is',
    Effect.gen(function* () {
      expect((yield* getTaxonomy('en')).bodyAreas).toEqual([{ id: 'chest', name: 'Chest' }]);
    }),
    catalog,
  );
});
