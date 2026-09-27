import { planFromRoutine } from '@/features/home/facades/planFromRoutine';
import { RoutineId } from '@/features/routines';

describe('planFromRoutine', () => {
  it('starts from the routine, named after it, with its exercises and targets in order', () => {
    const plan = planFromRoutine({
      id: RoutineId.make('rtn_push'),
      name: 'Push Day',
      items: [
        {
          id: 'rit_bench',
          exerciseId: 'wger:73',
          exerciseName: 'Bench Press',
          sets: 3,
          reps: '8-12',
          weightKg: 60,
          restSeconds: 90,
          notes: null,
        },
        {
          id: 'rit_press',
          exerciseId: 'wger:74',
          exerciseName: 'Overhead Press',
          sets: 4,
          reps: '6',
          weightKg: 40,
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
          exerciseId: 'wger:73',
          exerciseName: 'Bench Press',
          sets: 3,
          reps: '8-12',
          weightKg: 60,
          restSeconds: 90,
          notes: null,
        },
        {
          exerciseId: 'wger:74',
          exerciseName: 'Overhead Press',
          sets: 4,
          reps: '6',
          weightKg: 40,
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
