import { Effect, Layer } from 'effect';
import { SqlError } from '@/features/core/error';
import { itEffect } from '@/features/core/testing';
import type { Exercise, ExerciseSnapshot } from '@/features/exercises';
import { anExercise, anExerciseSnapshot } from '@/features/transfer/__fixtures__/builders';
import type { ParsedItem } from '@/features/transfer/domain/entities/ParsedImport';
import {
  ExerciseCatalogFake,
  ExerciseSnapshotRepositoryFake,
} from '@/features/transfer/useCases/__tests__/transferFakes';
import { resolveExercisesByName } from '@/features/transfer/useCases/resolveExercisesByName';

const matchOf = (item: ParsedItem) =>
  Effect.map(resolveExercisesByName([{ name: 'Push', items: [item] }], 'en'), ([routine]) => routine?.items[0]?.match);

const layer = (
  stored: readonly ExerciseSnapshot[],
  catalog: readonly Exercise[],
  options: { readonly searchFails?: SqlError } = {},
) =>
  Layer.merge(
    ExerciseSnapshotRepositoryFake(new Map(stored.map(snapshot => [snapshot.exerciseId, snapshot]))),
    ExerciseCatalogFake(catalog, options),
  );

describe('resolveExercisesByName', () => {
  itEffect(
    'matches an id the device has stored, with no catalog read',
    Effect.gen(function* () {
      expect(yield* matchOf(anItem({ exerciseId: 'ex:barbell-bench-press-medium-grip' }))).toEqual({
        status: 'stored',
        snapshot: anExerciseSnapshot(),
      });
    }),
    layer([anExerciseSnapshot()], []),
  );

  itEffect(
    'matches an id the catalog has, frozen as a snapshot now',
    Effect.gen(function* () {
      const match = yield* matchOf(anItem({ exerciseId: 'ex:barbell-bench-press-medium-grip' }));

      expect(match).toMatchObject({
        status: 'catalog',
        snapshot: { exerciseId: 'ex:barbell-bench-press-medium-grip', name: 'Bench Press' },
      });
    }),
    layer([], [anExercise()]),
  );

  itEffect(
    'falls through an unknown id to the name, among stored exercises first',
    Effect.gen(function* () {
      const match = yield* matchOf(anItem({ exerciseId: 'ex:not-in-the-catalog', exerciseName: 'bench press' }));

      expect(match).toEqual({ status: 'stored', snapshot: anExerciseSnapshot() });
    }),
    layer([anExerciseSnapshot()], []),
  );

  itEffect(
    'matches an exact name in the catalog, ignoring case and punctuation',
    Effect.gen(function* () {
      const match = yield* matchOf(anItem({ exerciseName: 'Bench-Press' }));

      expect(match).toMatchObject({
        status: 'catalog',
        snapshot: { exerciseId: 'ex:barbell-bench-press-medium-grip' },
      });
    }),
    layer(
      [],
      [
        anExercise({ id: 'ex:barbell-incline-bench-press-medium-grip', name: 'Bench Press Incline' }),
        anExercise({ name: 'Bench Press' }),
      ],
    ),
  );

  itEffect(
    "takes the catalog's top result for a name it does not have exactly, marked closest",
    Effect.gen(function* () {
      const match = yield* matchOf(anItem({ exerciseName: 'Bench' }));

      expect(match).toMatchObject({
        status: 'closest',
        snapshot: { exerciseId: 'ex:barbell-incline-bench-press-medium-grip' },
      });
    }),
    layer(
      [],
      [
        anExercise({ id: 'ex:barbell-incline-bench-press-medium-grip', name: 'Bench Press Incline' }),
        anExercise({ name: 'Bench Press' }),
      ],
    ),
  );

  itEffect(
    'reports an item that matches nothing as missing, never inventing an exercise',
    Effect.gen(function* () {
      expect(yield* matchOf(anItem({ exerciseName: 'Flying kick' }))).toEqual({ status: 'missing' });
    }),
    layer([], [anExercise()]),
  );

  itEffect(
    'reports an item as missing when the catalog search fails, keeping the rest of the import',
    Effect.gen(function* () {
      const resolved = yield* resolveExercisesByName(
        [
          {
            name: 'Push',
            items: [anItem({ exerciseName: 'Row' }), anItem({ exerciseId: 'ex:barbell-bench-press-medium-grip' })],
          },
        ],
        'en',
      );

      expect(resolved[0]?.items.map(item => item.match.status)).toEqual(['missing', 'stored']);
    }),
    layer([anExerciseSnapshot()], [], { searchFails: new SqlError({ message: 'catalog locked' }) }),
  );

  itEffect(
    'keeps the routines, their names and their targets as parsed',
    Effect.gen(function* () {
      const sets = [{ reps: 5, weightKg: 100, targetRpe: 8 }];
      const resolved = yield* resolveExercisesByName([{ name: null, items: [anItem({ sets })] }], 'en');

      expect(resolved[0]).toMatchObject({ name: null, items: [{ sets, exerciseName: 'Bench Press' }] });
    }),
    layer([anExerciseSnapshot()], []),
  );
});

function anItem(overrides: Partial<ParsedItem> = {}): ParsedItem {
  return {
    exerciseId: null,
    exerciseName: 'Bench Press',
    sets: [{ reps: 8, weightKg: 60, targetRpe: null }],
    restSeconds: 90,
    notes: null,
    ...overrides,
  };
}
