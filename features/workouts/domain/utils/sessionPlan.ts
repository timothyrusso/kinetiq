import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type {
  SessionPlan,
  SessionPlanItem,
  SessionPlanSet,
} from '@/features/workouts/domain/schemas/SessionPlanSchema';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { withEstimated1rm } from '@/features/workouts/domain/utils/oneRepMax';
import { entryOf, newSet } from '@/features/workouts/domain/utils/trackingSets';

/** The open set a planned set becomes at `index`: its targets, and its target RPE as the set's RPE. */
function setFromPlan(planned: SessionPlanSet, index: number): StrengthSet {
  const base = { index, completed: false, rpe: planned.targetRpe };
  switch (planned.type) {
    case 'weightReps':
      return withEstimated1rm({
        ...base,
        type: planned.type,
        reps: planned.reps,
        weightKg: planned.weightKg,
        estimated1rm: null,
      });
    case 'repsOnly':
      return { ...base, type: planned.type, reps: planned.reps };
    case 'duration':
      return { ...base, type: planned.type, durationSeconds: planned.durationSeconds };
  }
}

/**
 * The empty entry an item opens with: one open set per planned set, each on its own targets, so
 * the set holds what the routine displayed. An item with no planned sets opens with one, on its
 * type's defaults (8 reps at bodyweight, 8 reps, or 30 s). An item of a routine marks the entry
 * with the item and each set with its row, so a finish can write the workout back into them; the
 * fallback set has no row.
 */
export function entryFromPlanItem(item: SessionPlanItem): StrengthEntry {
  const fromRoutine = item.itemId !== undefined && item.sets.length > 0;
  const sets: StrengthSet[] =
    item.sets.length > 0
      ? item.sets.map((planned, index) => ({
          ...setFromPlan(planned, index),
          ...(fromRoutine ? { routineSetIndex: index } : {}),
        }))
      : [newSet(item.trackingType, 0)];
  return entryOf(
    {
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      muscleGroup: null,
      restSeconds: item.restSeconds,
      notes: item.notes,
      ...(item.itemId !== undefined ? { routineItemId: item.itemId } : {}),
    },
    item.trackingType,
    sets,
  );
}

/**
 * The routine items `plan` starts with, or `undefined` when it is not a routine's plan or an item
 * does not say which routine item it is.
 */
function plannedItemIds(plan: SessionPlan): readonly string[] | undefined {
  if (plan.routineId === null) return undefined;
  const ids = plan.items.flatMap(item => (item.itemId === undefined ? [] : [item.itemId]));
  return ids.length === plan.items.length ? ids : undefined;
}

/** The session id for a start at `now`: the time in base 36, which becomes the activity's id. */
function sessionIdAt(now: number): ActivityId {
  return ActivityId.make(`session-${now.toString(36)}`);
}

/** A running session built from `plan`, started at `now`, on its first exercise with no rest. */
export function sessionFromPlan(plan: SessionPlan, now: number): WorkoutSession {
  const routineItemIds = plannedItemIds(plan);
  return {
    id: sessionIdAt(now),
    routineId: plan.routineId,
    routineName: plan.name,
    startedAt: now,
    elapsedSeconds: 0,
    status: 'active',
    entries: plan.items.map(entryFromPlanItem),
    activeIndex: 0,
    restEndsAt: null,
    restDurationSeconds: null,
    notes: null,
    updatedAt: now,
    ...(routineItemIds !== undefined ? { routineItemIds } : {}),
  };
}
