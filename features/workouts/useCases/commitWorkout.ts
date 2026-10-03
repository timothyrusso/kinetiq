import { Effect } from 'effect';
import type { RoutineUpdate } from '@/features/workouts/domain/entities/RoutineUpdate';
import { DuplicateWorkout } from '@/features/workouts/domain/errors/WorkoutsErrors';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import { RoutineUsage } from '@/features/workouts/domain/services/RoutineUsage';
import { WorkoutTransaction } from '@/features/workouts/domain/services/WorkoutTransaction';
import { detectPersonalRecords } from '@/features/workouts/domain/utils/personalRecords';
import { recordPersonalRecords } from '@/features/workouts/useCases/recordPersonalRecords';

/** A workout as it went into history, and the records it set. */
export interface CommitResult {
  readonly activity: Activity;
  readonly personalRecords: readonly PersonalRecord[];
}

/** How far back record detection looks: a best from more than 400 workouts ago is not "a PR". */
const HISTORY_WINDOW = 400;

/**
 * Writes a finished workout to history: the one path for a phone session and a workout from the
 * Apple Watch. All or nothing: the duplicate check, the history read, record detection, the
 * insert, the records, the routine's trained count and, when `routineUpdate` is given, today's
 * values written back into the routine run in one transaction, so a crash cannot leave a workout
 * without its records, or a routine counted or changed for a workout never saved.
 *
 * A workout with no sets in it (every exercise removed) is not counted against its routine: its
 * trained count and last trained date stay as they were.
 *
 * Idempotent: a workout whose id is already in history fails with `DuplicateWorkout` and writes
 * nothing, because a replay would be compared against a history that already contains it.
 */
export const commitWorkout = (workout: CompletedWorkout, routineUpdate: RoutineUpdate | null = null) =>
  Effect.flatMap(WorkoutTransaction, transaction =>
    transaction.atomically(
      Effect.gen(function* () {
        const activities = yield* ActivityRepository;
        if ((yield* activities.byId(workout.id)) !== undefined) {
          return yield* new DuplicateWorkout({ activityId: workout.id });
        }
        // NOTE: the history before the insert: the workout being saved must not be its own baseline.
        const history = yield* activities.list({ order: 'desc', limit: HISTORY_WINDOW });
        const personalRecords = detectPersonalRecords(workout.entries, history, workout.endedAt);
        const activity = yield* activities.recordWorkout(workout, personalRecords);
        yield* recordPersonalRecords(personalRecords);
        const { routineId } = workout;
        const trained = workout.entries.some(entry => entry.sets.length > 0);
        if (routineId !== null && trained)
          yield* Effect.flatMap(RoutineUsage, usage => usage.markUsed(routineId, workout.endedAt));
        if (routineUpdate !== null) yield* Effect.flatMap(RoutineUsage, usage => usage.applyWorkout(routineUpdate));
        const result: CommitResult = { activity, personalRecords };
        return result;
      }),
    ),
  );
