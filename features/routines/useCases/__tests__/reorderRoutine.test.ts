import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { anotherRoutineItem, aRoutine, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { makeRoutineRepositoryFake } from '@/features/routines/useCases/__tests__/routineFakes';
import { reorderRoutine } from '@/features/routines/useCases/reorderRoutine';

const DIPS = aRoutineItem({ id: 'rit_dips', exerciseId: 'wger:75', exerciseName: 'Dips' });
const PUSH = aRoutine({ items: [aRoutineItem(), anotherRoutineItem(), DIPS] });

const itemIds = Effect.map(
  Effect.flatMap(RoutineRepository, repo => repo.byId(PUSH.id)),
  routine => routine?.items.map(item => item.id),
);

describe('reorderRoutine', () => {
  itEffect(
    'puts the items in the order given',
    Effect.gen(function* () {
      yield* reorderRoutine(PUSH.id, ['rit_dips', 'rit_bench', 'rit_press']);

      expect(yield* itemIds).toEqual(['rit_dips', 'rit_bench', 'rit_press']);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );

  itEffect(
    'ignores ids the routine does not have',
    Effect.gen(function* () {
      yield* reorderRoutine(PUSH.id, ['rit_gone', 'rit_press', 'rit_bench', 'rit_dips']);

      expect(yield* itemIds).toEqual(['rit_press', 'rit_bench', 'rit_dips']);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );

  itEffect(
    'keeps the items the list leaves out, after the named ones in their old order',
    Effect.gen(function* () {
      yield* reorderRoutine(PUSH.id, ['rit_dips']);

      expect(yield* itemIds).toEqual(['rit_dips', 'rit_bench', 'rit_press']);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );

  itEffect(
    'fails with RoutineNotFound for a routine that does not exist, and moves nothing',
    Effect.gen(function* () {
      const result = yield* Effect.either(reorderRoutine(RoutineId.make('rtn_gone'), ['rit_dips']));

      expect(Either.isLeft(result) && result.left._tag).toBe('RoutineNotFound');
      expect(yield* itemIds).toEqual(['rit_bench', 'rit_press', 'rit_dips']);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );

  itEffect(
    'fails with SqlError when the write fails',
    Effect.gen(function* () {
      const result = yield* Effect.either(reorderRoutine(PUSH.id, ['rit_dips']));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
    }),
    makeRoutineRepositoryFake([PUSH], 'reorder'),
  );
});
