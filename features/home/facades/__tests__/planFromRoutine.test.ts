import { planFromRoutine } from '@/features/home/facades/planFromRoutine';
import { RoutineId } from '@/features/routines';

describe('planFromRoutine', () => {
  it('starts from the routine, named after it, with its exercises in order and each naming its item and each set from its own row', () => {
    const plan = planFromRoutine({
      id: RoutineId.make('rtn_push'),
      name: 'Push Day',
      items: [
        {
          id: 'rit_bench',
          exerciseId: 'ex:barbell-bench-press',
          exerciseName: 'Bench Press',
          sets: [
            { index: 0, reps: 10, weightKg: 60, targetRpe: null },
            { index: 1, reps: 8, weightKg: 65, targetRpe: 8 },
          ],
          restSeconds: 90,
          notes: null,
        },
        {
          id: 'rit_press',
          exerciseId: 'ex:barbell-squat',
          exerciseName: 'Overhead Press',
          sets: [{ index: 0, reps: 6, weightKg: 40, targetRpe: 9 }],
          restSeconds: 60,
          notes: 'Brace first',
        },
      ],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      timesCompleted: 2,
      lastPerformedAt: 1_700_000_000_000,
    });

    expect(plan).toEqual({
      routineId: 'rtn_push',
      name: 'Push Day',
      items: [
        {
          trackingType: 'weightReps',
          itemId: 'rit_bench',
          exerciseId: 'ex:barbell-bench-press',
          exerciseName: 'Bench Press',
          sets: [
            { type: 'weightReps', reps: 10, weightKg: 60, targetRpe: null },
            { type: 'weightReps', reps: 8, weightKg: 65, targetRpe: 8 },
          ],
          restSeconds: 90,
          notes: null,
        },
        {
          trackingType: 'weightReps',
          itemId: 'rit_press',
          exerciseId: 'ex:barbell-squat',
          exerciseName: 'Overhead Press',
          sets: [{ type: 'weightReps', reps: 6, weightKg: 40, targetRpe: 9 }],
          restSeconds: 60,
          notes: 'Brace first',
        },
      ],
    });
  });

  it('starts an empty plan from a routine with no exercises', () => {
    const plan = planFromRoutine({
      id: RoutineId.make('rtn_empty'),
      name: 'Empty',
      items: [],
      createdAt: 0,
      updatedAt: 0,
      timesCompleted: 0,
      lastPerformedAt: null,
    });

    expect(plan.items).toEqual([]);
  });
});
