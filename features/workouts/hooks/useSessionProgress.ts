import { useMemo } from 'react';
import { sum } from '@/features/core/utils';
import type { StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { sessionProgress, setVolumeKg } from '@/features/workouts/domain/utils/workoutMath';

const NO_PROGRESS = { completed: 0, planned: 0, ratio: 0, volumeKg: 0 } as const;

/**
 * Sets done over sets planned, and the volume of the done loaded ones, for the workout in progress.
 * Keyed on the entries, which a clock tick leaves alone, so the maths runs once per change.
 */
export function useSessionProgress(session: WorkoutSession | null) {
  const entries = session?.entries;
  return useMemo(() => {
    if (entries === undefined) return NO_PROGRESS;
    const done: StrengthSet[] = entries.flatMap(entry => entry.sets.filter(set => set.completed));
    const volumeKg = sum(done.map(setVolumeKg));
    return { ...sessionProgress({ entries }), volumeKg };
  }, [entries]);
}
