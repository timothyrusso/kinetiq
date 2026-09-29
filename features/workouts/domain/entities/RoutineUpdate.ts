import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/**
 * What a finished workout writes back into the routine it started from: the exercises as they
 * ended, in the workout's order, each entry naming the routine item it was planned from (none for
 * an exercise added during the workout), and each set the routine set row it was planned from.
 */
export interface RoutineUpdate {
  readonly routineId: string;
  /**
   * The routine's items the workout started with. A routine item in this list and not in
   * `entries` was removed during the workout; one in neither was added to the routine meanwhile.
   */
  readonly plannedItemIds: readonly string[];
  readonly entries: readonly StrengthEntry[];
}
