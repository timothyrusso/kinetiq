import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/**
 * What a second tap on an exercise in the workout's picker does: removes the entry, or does
 * nothing and says why. Only an exercise with nothing banked comes out this way, since the picker
 * asks no confirmation, and the session keeps its last exercise as `removeExercise` does.
 */
export type PickRemoval =
  | { readonly kind: 'removable'; readonly entryIndex: number }
  | { readonly kind: 'hasCompletedSet' }
  | { readonly kind: 'lastExercise' }
  | { readonly kind: 'absent' };

/**
 * The removal for `exerciseId`. With the exercise in twice, the later entry is the one judged and
 * removed: the one a mistaken add would have made, as the routine picker does.
 */
export function pickRemoval(session: WorkoutSession | null, exerciseId: string): PickRemoval {
  if (session === null) return { kind: 'absent' };
  const entryIndex = session.entries.findLastIndex(entry => entry.exerciseId === exerciseId);
  const entry = session.entries[entryIndex];
  if (entry === undefined) return { kind: 'absent' };
  if (entry.sets.some(set => set.completed)) return { kind: 'hasCompletedSet' };
  if (session.entries.length <= 1) return { kind: 'lastExercise' };
  return { kind: 'removable', entryIndex };
}
