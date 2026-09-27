import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { aRoutine } from '@/features/routines/__fixtures__/builders';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { makeRoutineRepositoryFake } from '@/features/routines/useCases/__tests__/routineFakes';
import { renameRoutine } from '@/features/routines/useCases/renameRoutine';

const PUSH = aRoutine();
const LEGS = aRoutine({ id: RoutineId.make('rtn_legs'), name: 'Legs' });

describe('renameRoutine', () => {
  itEffect(
    'renames the routine',
    Effect.gen(function* () {
      yield* renameRoutine(PUSH.id, 'Chest');

      expect((yield* (yield* RoutineRepository).byId(PUSH.id))?.name).toBe('Chest');
    }),
    makeRoutineRepositoryFake([PUSH, LEGS]),
  );

  itEffect(
    'allows the routine to keep its own name in another case',
    Effect.gen(function* () {
      yield* renameRoutine(PUSH.id, 'PUSH DAY');

      expect((yield* (yield* RoutineRepository).byId(PUSH.id))?.name).toBe('PUSH DAY');
    }),
    makeRoutineRepositoryFake([PUSH, LEGS]),
  );

  itEffect(
    'fails with RoutineNameTaken for another routine’s name, and keeps the old name',
    Effect.gen(function* () {
      const result = yield* Effect.either(renameRoutine(PUSH.id, ' legs '));

      expect(Either.isLeft(result) && result.left._tag).toBe('RoutineNameTaken');
      expect((yield* (yield* RoutineRepository).byId(PUSH.id))?.name).toBe('Push Day');
    }),
    makeRoutineRepositoryFake([PUSH, LEGS]),
  );

  itEffect(
    'fails with RoutineNotFound for a routine that does not exist, and renames nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(renameRoutine(RoutineId.make('rtn_gone'), 'Chest'));

      expect(Either.isLeft(result) && result.left._tag).toBe('RoutineNotFound');
      expect((yield* (yield* RoutineRepository).list).map(routine => routine.name)).toEqual(['Legs', 'Push Day']);
    }),
    makeRoutineRepositoryFake([PUSH, LEGS]),
  );

  itEffect(
    'fails with SqlError when the rename fails',
    Effect.gen(function* () {
      const result = yield* Effect.either(renameRoutine(PUSH.id, 'Chest'));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
    }),
    makeRoutineRepositoryFake([PUSH], 'rename'),
  );
});
