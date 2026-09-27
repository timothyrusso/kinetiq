/**
 * The workout-side reads over a routine: what was lifted last time, and the empty entries a
 * session starts from. The routines themselves are `@/features/routines`; these belong to the
 * workout engine and move with it (#53).
 */
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { queryKeys } from '@/query/keys';
import { activityRepository } from '@/persistence';
import type { RoutineItem, StrengthEntry } from '@/domain/types';
import { estimatedOneRepMax } from '@/domain/logic';
import { repsFromRange } from '@/utils/format';

/* -------------------------------------------------- previous performance -- */

export type PreviousLift = {
  exerciseId: string;
  exerciseName: string;
  /** Sets from the most recent session that included this exercise. */
  sets: { reps: number; weightKg: number; estimated1rm: number | null }[];
  bestEstimated1rm: number | null;
  totalVolumeKg: number;
  performedAt: number;
};

/**
 * What the user lifted last time, per exercise in this routine.
 *
 * This is the single most valuable thing a strength screen can show: it is what
 * tells someone whether to add weight: and it is expensive to compute naively,
 * because "last time" means scanning history per exercise. One query per routine
 * does it once: fetch the most recent strength sessions, then index them by
 * exercise id, keeping the first occurrence of each.
 *
 * Keyed on `routineId` rather than on the session, so finishing a workout
 * invalidates exactly the routine that was performed (`invalidateAfterWorkout`)
 * and nothing else.
 */
export function usePreviousPerformance(routineId: string | null, exerciseIds: readonly string[] = []) {
  const wanted = useMemo(() => new Set(exerciseIds), [exerciseIds]);

  const query = useQuery({
    queryKey: routineId
      ? queryKeys.session.previousPerformance(routineId)
      : ['session', 'previous', 'none'],
    queryFn: async () => {
      // A deliberately generous window: someone who trains a routine fortnightly
      // would get "no previous data" from a 4-week scan, and "no previous data" is
      // the answer only when there genuinely is none.
      const history = await activityRepository.list({ order: 'desc', limit: 24 });
      const byExercise = new Map<string, PreviousLift>();

      // `history` is newest-first, so the first hit per exercise *is* the last time.
      for (const activity of history) {
        for (const entry of activity.strength?.entries ?? []) {
          if (wanted.size > 0 && !wanted.has(entry.exerciseId)) continue;
          if (byExercise.has(entry.exerciseId)) continue;
          const done = entry.sets.filter((s) => s.completed || s.reps > 0);
          const best = done.reduce<number | null>((acc, s) => {
            const oneRm = s.estimated1rm ?? estimatedOneRepMax(s.weightKg, s.reps);
            return oneRm === null ? acc : acc === null || oneRm > acc ? oneRm : acc;
          }, null);
          byExercise.set(entry.exerciseId, {
            exerciseId: entry.exerciseId,
            exerciseName: entry.exerciseName,
            sets: done.map((s) => ({
              reps: s.reps,
              weightKg: s.weightKg,
              estimated1rm: s.estimated1rm ?? estimatedOneRepMax(s.weightKg, s.reps),
            })),
            bestEstimated1rm: best,
            totalVolumeKg: entry.sets.reduce(
              (acc, s) => acc + s.reps * s.weightKg,
              0,
            ),
            performedAt: activity.startedAt,
          });
        }
        if (wanted.size > 0 && byExercise.size >= wanted.size) break;
      }
      return byExercise;
    },
    enabled: routineId !== null,
    staleTime: 60_000,
  });

  const previous = query.data ?? new Map<string, PreviousLift>();
  const get = useCallback((exerciseId: string) => previous.get(exerciseId), [previous]);
  return { get, previous, isLoading: query.isLoading, error: query.error };
}

/* ---------------------------------------------------------------- helpers -- */

/**
 * Turns a routine's items into the empty set of entries a new session starts from.
 *
 * Lives here rather than in the session module because it needs to know that
 * `weightKg: 0` means bodyweight and that `reps` is a string a program may have put
 * "5-8" into: i.e. it is a routine-shape concern, not a session-engine one. The rep number
 * comes from `repsFromRange` so the set the session opens with holds the same number the
 * routine screen displayed for it.
 */
export function entriesFromItems(items: readonly RoutineItem[]): StrengthEntry[] {
  return items.map((item) => ({
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    muscleGroup: null,
    restSeconds: item.restSeconds,
    notes: item.notes,
    sets: Array.from({ length: Math.max(1, item.sets) }, (_, index) => ({
      index,
      reps: repsFromRange(item.reps),
      weightKg: item.weightKg,
      completed: false,
      estimated1rm: null,
      rpe: null,
    })),
  }));
}
