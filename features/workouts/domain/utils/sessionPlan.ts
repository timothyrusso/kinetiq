import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type {
  SessionPlan,
  SessionPlanItem,
  SessionPlanSet,
} from '@/features/workouts/domain/schemas/SessionPlanSchema';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { withEstimated1rm } from '@/features/workouts/domain/utils/workoutMath';

/** The set an item with no planned sets opens with: 8 reps at bodyweight. */
const FALLBACK_SET: SessionPlanSet = { reps: 8, weightKg: 0, targetRpe: null };

/**
 * The empty entry an item opens with: one open set per planned set, each on its own reps, load
 * and target RPE, so the set holds what the routine displayed. An item with no planned sets
 * opens with one.
 */
export function entryFromPlanItem(item: SessionPlanItem): StrengthEntry {
  const planned = item.sets.length > 0 ? item.sets : [FALLBACK_SET];
  return {
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    muscleGroup: null,
    restSeconds: item.restSeconds,
    notes: item.notes,
    sets: planned.map((set, index) => ({
      index,
      reps: set.reps,
      weightKg: set.weightKg,
      completed: false,
      estimated1rm: null,
      rpe: set.targetRpe,
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
