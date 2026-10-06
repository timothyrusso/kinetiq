import type { Routine, RoutineItem } from '@/features/routines';
import { RoutineId } from '@/features/routines';

type WeightRepsItem = Extract<RoutineItem, { readonly trackingType: 'weightReps' }>;

type WeightRepsSet = WeightRepsItem['sets'][number];

/** `count` sets of `reps` at `weightKg`, with no target RPE. */
export const setsOf = (count: number, reps: number, weightKg: number): WeightRepsSet[] =>
  Array.from({ length: count }, (_, index) => ({ type: 'weightReps', index, reps, weightKg, targetRpe: null }));

/** One item: bench press, four sets of eight at 60 kg, resting 120 s. */
export const aRoutineItem = (overrides: Partial<WeightRepsItem> = {}): WeightRepsItem => ({
  trackingType: 'weightReps',
  id: 'rit_1',
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  sets: setsOf(4, 8, 60),
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
