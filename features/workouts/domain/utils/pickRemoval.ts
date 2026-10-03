import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/**
 * What a second tap on an exercise in the workout's picker does: removes the entry, or does
 * nothing and says why. Only an exercise with nothing banked comes out this way, since the picker
 * asks no confirmation. The workout's last exercise comes out too, back to the empty workout.
 */
export type PickRemoval =
  | { readonly kind: 'removable'; readonly entryIndex: number }
  | { readonly kind: 'hasCompletedSet' }
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
  return { kind: 'removable', entryIndex };
}
