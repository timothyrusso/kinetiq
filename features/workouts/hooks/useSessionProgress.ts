import { useMemo } from 'react';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { sessionProgress } from '@/features/workouts/domain/utils/workoutMath';

const NO_PROGRESS = { completed: 0, planned: 0, ratio: 0, volumeKg: 0 } as const;

/**
 * Sets done over sets planned, and the volume of the done ones, for the workout in progress.
 * Keyed on the entries, which a clock tick leaves alone, so the maths runs once per change.
 */
export function useSessionProgress(session: WorkoutSession | null) {
  const entries = session?.entries;
  return useMemo(() => {
    if (entries === undefined) return NO_PROGRESS;
    const volumeKg = entries.reduce(
      (total, entry) => total + entry.sets.reduce((sum, set) => sum + (set.completed ? set.reps * set.weightKg : 0), 0),
      0,
    );
    return { ...sessionProgress({ entries }), volumeKg };
  }, [entries]);
}
