import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { anExerciseSnapshot, aRoutine, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { uniformSets } from '@/features/routines/domain/utils/itemTargets';
import { makeRoutineRepositoryFake, makeRoutinesFake } from '@/features/routines/useCases/__tests__/routineFakes';
import { deleteRoutine } from '@/features/routines/useCases/deleteRoutine';
import { getRoutineDetail } from '@/features/routines/useCases/getRoutineDetail';
import { listRoutines } from '@/features/routines/useCases/listRoutines';
import { removeRoutineItem } from '@/features/routines/useCases/removeRoutineItem';
import { setRoutineItem } from '@/features/routines/useCases/setRoutineItem';

const PUSH = aRoutine();

describe('listRoutines', () => {
  itEffect(
    'returns every routine',
    Effect.gen(function* () {
      expect(yield* listRoutines).toEqual([PUSH]);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );

  itEffect(
    'fails with SqlError when the routines cannot be read',
    Effect.gen(function* () {
      const result = yield* Effect.either(listRoutines);

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
    }),
    makeRoutineRepositoryFake([PUSH], 'list'),
  );
});

describe('getRoutineDetail', () => {
  itEffect(
    'returns the routine with the stored snapshots of its exercises',
    Effect.gen(function* () {
      const detail = yield* getRoutineDetail(PUSH.id);

      expect(detail?.routine).toEqual(PUSH);
      expect([...(detail?.snapshots.keys() ?? [])]).toEqual(['wger:73']);
    }),
    makeRoutinesFake([PUSH], [anExerciseSnapshot(), anExerciseSnapshot({ exerciseId: 'wger:1', name: 'Squat' })]),
  );

  itEffect(
    'returns null for a routine that does not exist',
    Effect.gen(function* () {
      expect(yield* getRoutineDetail(RoutineId.make('rtn_gone'))).toBeNull();
    }),
    makeRoutinesFake([PUSH]),
  );
});

describe('deleteRoutine', () => {
  itEffect(
    'deletes the routine',
    Effect.gen(function* () {
      yield* deleteRoutine(PUSH.id);

      expect(yield* (yield* RoutineRepository).list).toEqual([]);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );
});

describe('setRoutineItem', () => {
  itEffect(
    'changes the item’s targets',
    Effect.gen(function* () {
      yield* setRoutineItem('rit_bench', { sets: uniformSets(5, 8, 60) });

      expect((yield* (yield* RoutineRepository).byId(PUSH.id))?.items[0]).toEqual(
        aRoutineItem({ sets: uniformSets(5, 8, 60) }),
      );
    }),
    makeRoutineRepositoryFake([PUSH]),
  );
});

describe('removeRoutineItem', () => {
  itEffect(
    'removes the item from the routine',
    Effect.gen(function* () {
      yield* removeRoutineItem(PUSH.id, 'rit_bench');

      expect((yield* (yield* RoutineRepository).byId(PUSH.id))?.items.map(item => item.id)).toEqual(['rit_press']);
    }),
    makeRoutineRepositoryFake([PUSH]),
  );
});
