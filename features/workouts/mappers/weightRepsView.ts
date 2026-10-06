import type { StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { setEstimate } from '@/features/workouts/domain/utils/oneRepMax';

/** A set's values as the screens that draw weight and reps read them. */
interface WeightRepsView {
  readonly reps: number;
  readonly weightKg: number;
  readonly estimated1rm: number | null;
}

/**
 * Any set as weight and reps: a reps-only set reads at bodyweight, a timed one as 0 reps at
 * bodyweight. Only the set rows, the exercise editor and the activity card read this.
 */
export function weightRepsView(set: StrengthSet): WeightRepsView {
  // HACK: the screens draw weight and reps only until the phone UI child (#192) gives each
  // tracking type its own row; this goes with it.
  switch (set.type) {
    case 'weightReps':
      return { reps: set.reps, weightKg: set.weightKg, estimated1rm: setEstimate(set) };
    case 'repsOnly':
      return { reps: set.reps, weightKg: 0, estimated1rm: null };
    case 'duration':
      return { reps: 0, weightKg: 0, estimated1rm: null };
  }
}
