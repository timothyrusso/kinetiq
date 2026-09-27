import { Clock, Effect } from 'effect';
import { SessionAlreadyActive } from '@/features/workouts/domain/errors/WorkoutsErrors';
import type { SessionPlan } from '@/features/workouts/domain/schemas/SessionPlanSchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { sessionFromPlan } from '@/features/workouts/domain/utils/sessionPlan';
import { isInProgress } from '@/features/workouts/domain/utils/sessionStatus';

/**
 * The session `plan` starts, now. Fails with `SessionAlreadyActive` while `current` is in
 * progress: the store holds one workout, so a second start would silently replace the first.
 * Nothing is written here; the store queues the first write when it takes the session.
 */
export const startSession = (plan: SessionPlan, current: WorkoutSession | null) =>
  Effect.gen(function* () {
    if (isInProgress(current)) return yield* new SessionAlreadyActive({ sessionId: current.id });
    return sessionFromPlan(plan, yield* Clock.currentTimeMillis);
  });
