import { Effect, Layer } from 'effect';
import { itEffect, makeTestAppLayer } from '@/features/core/testing';
import { aRoutineItem } from '@/features/home/__fixtures__/builders';
import { HomeTestLayer, seedRoutine } from '@/features/home/di/__tests__/homeTestLayer';
import { RoutineRepository } from '@/features/routines';
import { RoutineUsage } from '@/features/workouts';

const layer = () => HomeTestLayer.pipe(Layer.provideMerge(makeTestAppLayer().layer));

describe('RoutineUsageLive', () => {
  itEffect(
    'writes a finished workout back into the stored routine',
    Effect.gen(function* () {
      const routine = yield* seedRoutine('Push', [aRoutineItem()]);
      const [item] = routine.items;
      if (item === undefined) throw new Error('no item seeded');

      yield* (yield* RoutineUsage).applyWorkout({
        routineId: routine.id,
        plannedItemIds: [item.id],
        entries: [
          {
            exerciseId: item.exerciseId,
            exerciseName: item.exerciseName,
            muscleGroup: null,
            sets: [
              { index: 0, reps: 10, weightKg: 70, completed: true, estimated1rm: null, rpe: 8, routineSetIndex: 0 },
              { index: 1, reps: 8, weightKg: 60, completed: false, estimated1rm: null, rpe: null, routineSetIndex: 1 },
            ],
            notes: null,
            restSeconds: 90,
            routineItemId: item.id,
          },
        ],
      });

      const stored = yield* (yield* RoutineRepository).byId(routine.id);
      expect(stored?.items.map(({ id, sets }) => ({ id, sets }))).toEqual([
        {
          id: item.id,
          sets: [
            { index: 0, reps: 10, weightKg: 70, targetRpe: 8 },
            { index: 1, reps: 8, weightKg: 60, targetRpe: null },
          ],
        },
      ]);
    }),
    layer(),
  );
});
