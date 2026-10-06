import type { WeightRepsSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

function roundKg(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Epley, to the half kilogram. Null for bodyweight work and past 15 reps, where the linear model
 * extrapolates rather than estimates.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return roundKg(weightKg);
  if (reps > 15) return null;
  return roundKg(weightKg * (1 + reps / 30));
}

/** A completed loaded set with its estimate refreshed; an open set is returned as it is. */
export function withEstimated1rm(set: WeightRepsSet): WeightRepsSet {
  if (!set.completed) return set;
  return { ...set, estimated1rm: estimatedOneRepMax(set.weightKg, set.reps) };
}

/** A loaded set's estimated one-rep max, as stored or worked out now; null when it has none. */
export function setEstimate(set: WeightRepsSet): number | null {
  return set.estimated1rm ?? estimatedOneRepMax(set.weightKg, set.reps);
}
