import { Clock, Effect } from 'effect';
import { NoActiveSession } from '@/features/workouts/domain/errors/WorkoutsErrors';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { routineUpdateOf } from '@/features/workouts/domain/utils/routineUpdate';
import { toCompletedWorkout } from '@/features/workouts/domain/utils/workoutMath';
import { type CommitResult, commitWorkout } from '@/features/workouts/useCases/commitWorkout';
import { weeklyGoalReached } from '@/features/workouts/useCases/weeklyGoalReached';

/** A finish: the workout as recorded, its records, and whether it met this week's goal. */
interface FinishResult extends CommitResult {
  /** Only asked when the workout set no record: a record's own moment takes the finish. */
  readonly closedWeeklyGoal: boolean;
}

/**
 * Records session `id`: the one in memory when it is that session, else the stored row. Its row
 * is marked finished first, so it can never be restored as a workout in progress, then it goes
 * through `commitWorkout` like a watch workout, with records detected against the history before
 * it. With `updateRoutine`, today's values go back into the routine it started from, in the same
 * transaction. A session that is gone or discarded fails with `NoActiveSession` and writes nothing.
 */
export const finishSession = (
  id: ActivityId,
  inMemory: WorkoutSession | null,
  weeklyGoal: number,
  updateRoutine: boolean,
) =>
  Effect.gen(function* () {
    const sessions = yield* SessionRepository;
    const target = inMemory?.id === id ? inMemory : yield* sessions.byId(id);
    if (target === undefined || target.status === 'discarded') {
      return yield* new NoActiveSession({ sessionId: id });
    }
    const endedAt = yield* Clock.currentTimeMillis;
    yield* sessions.setStatus(id, 'finished');
    const routineUpdate = updateRoutine ? routineUpdateOf(target) : null;
    const result = yield* commitWorkout(toCompletedWorkout(target, endedAt), routineUpdate);
    const closedWeeklyGoal =
      result.personalRecords.length === 0 ? yield* weeklyGoalReached(weeklyGoal, endedAt) : false;
    const finished: FinishResult = { ...result, closedWeeklyGoal };
    return finished;
  });
