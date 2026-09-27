import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aRoutine } from '@/features/routines/__fixtures__/builders';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { makeRoutineRepositoryFake } from '@/features/routines/useCases/__tests__/routineFakes';
import { duplicateRoutine } from '@/features/routines/useCases/duplicateRoutine';

const PUSH = aRoutine();

describe('duplicateRoutine', () => {
  itEffect(
    'saves a copy with the same plan under new item ids',
    Effect.gen(function* () {
      const copy = yield* duplicateRoutine(PUSH.id);

      expect(copy.id).not.toBe(PUSH.id);
      expect(copy.name).toBe('Push Day copy');
      expect(copy.items.map(item => item.exerciseId)).toEqual(PUSH.items.map(item => item.exerciseId));
      expect(copy.items.some(item => PUSH.items.some(original => original.id === item.id))).toBe(false);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );

  itEffect(
    'numbers the copy’s name when a copy already exists',
    Effect.gen(function* () {
      const copy = yield* duplicateRoutine(PUSH.id);

      expect(copy.name).toBe('Push Day copy 2');
    }),
    makeRoutineRepositoryFake([PUSH, aRoutine({ id: RoutineId.make('rtn_copy'), name: 'Push Day copy' })]),
  );

  itEffect(
    'fails with RoutineNotFound for a routine that does not exist, and saves nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(duplicateRoutine(RoutineId.make('rtn_gone')));

      expect(Either.isLeft(result) && result.left._tag).toBe('RoutineNotFound');
      expect(yield* (yield* RoutineRepository).list).toEqual([PUSH]);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );
});
