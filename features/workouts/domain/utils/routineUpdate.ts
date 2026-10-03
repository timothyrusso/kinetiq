import type { RoutineUpdate } from '@/features/workouts/domain/entities/RoutineUpdate';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';

/**
 * What finishing `session` would write back into its routine, or `null` when there is nothing to
 * write it into: a workout that did not start from a routine, or one started before a session
 * knew which routine items it was planned from. A workout left with no exercises writes nothing
 * either: every planned item would read as removed, and removing everything mid-workout is not
 * asking for an empty routine.
 */
export function routineUpdateOf(session: WorkoutSession): RoutineUpdate | null {
  const { routineId, routineItemIds } = session;
  if (routineId === null || routineItemIds === undefined || session.entries.length === 0) return null;
  return { routineId, plannedItemIds: routineItemIds, entries: session.entries };
}
