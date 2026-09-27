import { Effect, Either, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { ExerciseSnapshotRepository } from '@/features/exercises';
import { anExerciseSnapshot, aRoutine, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import {
  makeRoutineRepositoryFake,
  makeRoutinesFake,
  makeSnapshotRepositoryFake,
} from '@/features/routines/useCases/__tests__/routineFakes';
import { createRoutine, type NewRoutine } from '@/features/routines/useCases/createRoutine';

const aNewRoutine = (overrides: Partial<NewRoutine> = {}): NewRoutine => ({
  name: 'Chest',
  items: [aRoutineItem()],
  snapshots: [anExerciseSnapshot()],
  ...overrides,
});

describe('createRoutine', () => {
  itEffect(
    'saves the routine under the typed name',
    Effect.gen(function* () {
      const saved = yield* createRoutine(aNewRoutine({ name: '  Chest  ' }));

      expect(saved.name).toBe('Chest');
      expect((yield* (yield* RoutineRepository).byId(saved.id))?.items).toEqual([aRoutineItem()]);
    }),
    makeRoutinesFake(),
  );

  itEffect(
    'stores the snapshots of the exercises it picked',
    Effect.gen(function* () {
      yield* createRoutine(aNewRoutine());

      expect(yield* (yield* ExerciseSnapshotRepository).byId('wger:73')).toEqual(anExerciseSnapshot());
    }),
    makeRoutinesFake(),
  );

  itEffect(
    'names an unnamed routine after its exercises',
    Effect.gen(function* () {
      const saved = yield* createRoutine(
        aNewRoutine({ name: ' ', items: [aRoutineItem(), aRoutineItem({ id: 'rit_2', exerciseName: 'Dips' })] }),
      );

      expect(saved.name).toBe('Bench Press + 1 more');
    }),
    makeRoutinesFake(),
  );

  itEffect(
    'numbers the derived name when a routine already has it',
    Effect.gen(function* () {
      const saved = yield* createRoutine(aNewRoutine({ name: '' }));

      expect(saved.name).toBe('Bench Press 2');
    }),
    makeRoutinesFake([aRoutine({ name: 'Bench Press' })]),
  );

  itEffect(
    'fills an item with no name from its snapshot',
    Effect.gen(function* () {
      const saved = yield* createRoutine(aNewRoutine({ items: [aRoutineItem({ exerciseName: '' })] }));

      expect(saved.items[0]?.exerciseName).toBe('Bench Press');
    }),
    makeRoutinesFake(),
  );

  itEffect(
    'fails with RoutineNameTaken for a name another routine has, and stores nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(createRoutine(aNewRoutine({ name: 'push day' })));

      expect(Either.isLeft(result) && result.left._tag).toBe('RoutineNameTaken');
      expect(yield* (yield* RoutineRepository).list).toEqual([aRoutine()]);
      expect(yield* (yield* ExerciseSnapshotRepository).byId('wger:73')).toBeUndefined();
    }),
    makeRoutinesFake([aRoutine()]),
  );

  itEffect(
    'fails with SqlError when the routines cannot be read, and stores nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(createRoutine(aNewRoutine()));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(yield* (yield* ExerciseSnapshotRepository).byId('wger:73')).toBeUndefined();
    }),
    Layer.merge(makeRoutineRepositoryFake([], 'list'), makeSnapshotRepositoryFake()),
  );

  itEffect(
    'fails with SqlError when the save fails',
    Effect.gen(function* () {
      const result = yield* Effect.either(createRoutine(aNewRoutine()));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
    }),
    Layer.merge(makeRoutineRepositoryFake([], 'save'), makeSnapshotRepositoryFake()),
  );
});
