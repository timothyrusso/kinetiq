import { Effect } from 'effect';
import { startOfWeek } from '@/features/core/utils';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';

/**
 * Whether the workouts of the week holding `now` number exactly `goal`: the workout just saved is
 * the one that met it. Exactly, not at least: the sixth of a five-a-week goal is an ordinary
 * finish. Counted like the Profile ring, so the haptic and the ring agree.
 *
 * A read that fails answers `false`: the finish is already saved, and the fallback is the
 * ordinary finish haptic rather than an error over a workout that went in fine.
 */
export const weeklyGoalReached = (goal: number, now: number) =>
  Effect.flatMap(ActivityRepository, repository => repository.list({ from: startOfWeek(now).getTime() })).pipe(
    Effect.map(thisWeek => thisWeek.length === goal),
    Effect.orElseSucceed(() => false),
  );
