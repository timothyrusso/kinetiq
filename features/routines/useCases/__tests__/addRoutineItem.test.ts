import { Effect, Either, TestClock } from 'effect';
import { itEffect } from '@/features/core/testing';
import { ExerciseSnapshotRepository } from '@/features/exercises';
import { anExercise, anExerciseSnapshot, aRoutine } from '@/features/routines/__fixtures__/builders';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { defaultItemTarget } from '@/features/routines/domain/utils/itemTargets';
import { makeRoutinesFake } from '@/features/routines/useCases/__tests__/routineFakes';
import { addRoutineItem } from '@/features/routines/useCases/addRoutineItem';

const EMPTY = aRoutine({ items: [] });
const DIPS = anExercise({ id: 'ex:dips', name: 'Dips', imageUrl: null, thumbnailUrl: null });

describe('addRoutineItem', () => {
  itEffect(
    'appends the exercise with the given targets',
    Effect.gen(function* () {
      yield* addRoutineItem(EMPTY.id, DIPS, defaultItemTarget(90));

      const [item] = (yield* (yield* RoutineRepository).byId(EMPTY.id))?.items ?? [];
      expect(item).toMatchObject({ exerciseId: 'ex:dips', exerciseName: 'Dips', ...defaultItemTarget(90) });
      expect(item?.id).toMatch(/^rit_/);
    }),
    makeRoutinesFake([EMPTY]),
  );

  itEffect(
    'stores the exercise’s snapshot, captured now',
    Effect.gen(function* () {
      yield* TestClock.setTime(1_760_000_000_000);

      yield* addRoutineItem(EMPTY.id, anExercise(), defaultItemTarget(90));

      expect(yield* (yield* ExerciseSnapshotRepository).byId('ex:barbell-bench-press')).toEqual(
        anExerciseSnapshot({ capturedAt: 1_760_000_000_000 }),
      );
    }),
    makeRoutinesFake([EMPTY]),
  );

  itEffect(
    'fails with RoutineNotFound for a routine that does not exist, and stores no snapshot',
    Effect.gen(function* () {
      const result = yield* Effect.either(addRoutineItem(RoutineId.make('rtn_gone'), DIPS, defaultItemTarget(90)));

      expect(Either.isLeft(result) && result.left._tag).toBe('RoutineNotFound');
      expect(yield* (yield* ExerciseSnapshotRepository).byId('ex:dips')).toBeUndefined();
    }),
    makeRoutinesFake([EMPTY]),
  );
});
