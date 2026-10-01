import { Effect, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { type ExerciseSnapshot, ExerciseSnapshotRepository } from '@/features/exercises';
import { type Routine, RoutineRepository } from '@/features/routines';
import { anExerciseSnapshot } from '@/features/transfer/__fixtures__/builders';
import type { ResolvedItem, ResolvedRoutine } from '@/features/transfer/domain/entities/ResolvedImport';
import {
  ExerciseSnapshotRepositoryFake,
  RoutineRepositoryFake,
} from '@/features/transfer/useCases/__tests__/transferFakes';
import { saveImport } from '@/features/transfer/useCases/saveImport';

const fallbackName = (number: number) => `Routine ${number}`;

const layer = (routines: Routine[] = [], stored = new Map<string, ExerciseSnapshot>()) =>
  Layer.merge(RoutineRepositoryFake(routines), ExerciseSnapshotRepositoryFake(stored));

const savedRoutines = Effect.flatMap(RoutineRepository, repository => repository.list);

describe('saveImport', () => {
  itEffect(
    'writes each routine as a new one with its matched exercises and every planned set in order',
    Effect.gen(function* () {
      const saved = yield* saveImport([aRoutine()], fallbackName, 120);

      expect(saved).toBe(1);
      const [routine] = yield* savedRoutines;
      expect(routine?.name).toBe('Push');
      expect(routine?.items.map(({ id: _id, ...item }) => item)).toEqual([
        {
          exerciseId: 'ex:barbell-bench-press-medium-grip',
          exerciseName: 'Bench Press',
          sets: [
            { index: 0, reps: 10, weightKg: 50, targetRpe: null },
            { index: 1, reps: 8, weightKg: 60, targetRpe: 7 },
            { index: 2, reps: 8, weightKg: 60, targetRpe: 8 },
          ],
          restSeconds: 90,
          notes: null,
        },
      ]);
    }),
    layer(),
  );

  itEffect(
    "gives an item with no rest of its own the user's default",
    Effect.gen(function* () {
      yield* saveImport([aRoutine({ items: [anItem({ restSeconds: null })] })], fallbackName, 120);

      const [routine] = yield* savedRoutines;
      expect(routine?.items[0]?.restSeconds).toBe(120);
    }),
    layer(),
  );

  itEffect(
    'names an unnamed routine by its place in the whole file',
    Effect.gen(function* () {
      yield* saveImport(
        [aRoutine({ items: [anItem({ match: { status: 'missing', offline: false } })] }), aRoutine({ name: null })],
        fallbackName,
        120,
      );

      expect((yield* savedRoutines).map(routine => routine.name)).toEqual(['Routine 2']);
    }),
    layer(),
  );

  itEffect(
    'leaves out the items that matched nothing, and the routines with none matched',
    Effect.gen(function* () {
      const saved = yield* saveImport(
        [
          aRoutine({
            items: [anItem(), anItem({ exerciseName: 'Flying kick', match: { status: 'missing', offline: false } })],
          }),
          aRoutine({ name: 'Nothing', items: [anItem({ match: { status: 'missing', offline: false } })] }),
        ],
        fallbackName,
        120,
      );

      expect(saved).toBe(1);
      const routines = yield* savedRoutines;
      expect(routines.map(routine => [routine.name, routine.items.length])).toEqual([['Push', 1]]);
    }),
    layer(),
  );

  itEffect(
    'stores the snapshot of an exercise found in the catalog before an item points at it',
    Effect.gen(function* () {
      const fromCatalog = anExerciseSnapshot({ exerciseId: 'ex:barbell-squat', name: 'Squat' });

      yield* saveImport(
        [aRoutine({ items: [anItem({ match: { status: 'catalog', snapshot: fromCatalog } })] })],
        fallbackName,
        120,
      );

      expect(
        yield* Effect.flatMap(ExerciseSnapshotRepository, repository => repository.byId('ex:barbell-squat')),
      ).toEqual(fromCatalog);
    }),
    layer(),
  );
});

function anItem(overrides: Partial<ResolvedItem<ExerciseSnapshot>> = {}): ResolvedItem<ExerciseSnapshot> {
  return {
    exerciseId: 'ex:barbell-bench-press-medium-grip',
    exerciseName: 'Bench Press',
    sets: [
      { reps: 10, weightKg: 50, targetRpe: null },
      { reps: 8, weightKg: 60, targetRpe: 7 },
      { reps: 8, weightKg: 60, targetRpe: 8 },
    ],
    restSeconds: 90,
    notes: null,
    match: { status: 'stored', snapshot: anExerciseSnapshot() },
    ...overrides,
  };
}

function aRoutine(overrides: Partial<ResolvedRoutine<ExerciseSnapshot>> = {}): ResolvedRoutine<ExerciseSnapshot> {
  return { name: 'Push', items: [anItem()], ...overrides };
}
