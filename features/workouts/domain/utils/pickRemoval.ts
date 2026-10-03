import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

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
 * The removal for `exerciseId` from the workout's `entries` (none without a workout). With the
 * exercise in twice, the later entry is the one judged and removed: the one a mistaken add would
 * have made, as the routine picker does.
 */
export function pickRemoval(entries: readonly StrengthEntry[] | undefined, exerciseId: string): PickRemoval {
  if (entries === undefined) return { kind: 'absent' };
  const entryIndex = entries.findLastIndex(entry => entry.exerciseId === exerciseId);
  const entry = entries[entryIndex];
  if (entry === undefined) return { kind: 'absent' };
  if (entry.sets.some(set => set.completed)) return { kind: 'hasCompletedSet' };
  if (entries.length <= 1) return { kind: 'lastExercise' };
  return { kind: 'removable', entryIndex };
}
