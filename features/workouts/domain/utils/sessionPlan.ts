import { repsFromRange } from '@/features/core/utils';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { SessionPlan, SessionPlanItem } from '@/features/workouts/domain/schemas/SessionPlanSchema';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { withEstimated1rm } from '@/features/workouts/domain/utils/workoutMath';

/**
 * The empty entry an item opens with: at least one set, each on the item's load and the number
 * its rep range starts with, so the set holds what the routine displayed.
 */
export function entryFromPlanItem(item: SessionPlanItem): StrengthEntry {
  return {
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
  };
}

/** The session id for a start at `now`: the time in base 36, which becomes the activity's id. */
function sessionIdAt(now: number): ActivityId {
  return ActivityId.make(`session-${now.toString(36)}`);
}

/** A running session built from `plan`, started at `now`, on its first exercise with no rest. */
export function sessionFromPlan(plan: SessionPlan, now: number): WorkoutSession {
  return {
    id: sessionIdAt(now),
    routineId: plan.routineId,
    routineName: plan.name,
    startedAt: now,
    elapsedSeconds: 0,
    status: 'active',
    entries: plan.items.map(item => {
      const entry = entryFromPlanItem(item);
      return { ...entry, sets: entry.sets.map(withEstimated1rm) };
    }),
    activeIndex: 0,
    restEndsAt: null,
    restDurationSeconds: null,
    notes: null,
    updatedAt: now,
  };
}
