import type { Routine, RoutineItem } from '@/features/routines';
import { RoutineId } from '@/features/routines';

/** One item: bench press, four sets of eight to ten at 60 kg, resting 120 s. */
export const aRoutineItem = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: 'rit_1',
  exerciseId: 'wger:73',
  exerciseName: 'Bench Press',
  sets: 4,
  reps: '8-10',
  weightKg: 60,
  restSeconds: 120,
  notes: null,
  ...overrides,
});

/** A push day with that one item, never trained. */
export const aRoutine = (overrides: Partial<Routine> = {}): Routine => ({
  id: RoutineId.make('rtn_1'),
  name: 'Push',
  items: [aRoutineItem()],
  createdAt: 0,
  updatedAt: 0,
  timesCompleted: 0,
  lastPerformedAt: null,
  ...overrides,
});
