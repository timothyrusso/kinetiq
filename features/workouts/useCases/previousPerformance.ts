import { Effect } from 'effect';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { indexPreviousLifts } from '@/features/workouts/domain/utils/previousPerformance';

/**
 * A generous window: someone who trains a routine fortnightly would get "no previous data" from
 * a four-week scan, and that is the answer only when there genuinely is none.
 */
const RECENT_WORKOUTS = 24;

/** What the user lifted last time on each of `exerciseIds` (every exercise, when empty). */
export const previousPerformance = (exerciseIds: readonly string[]) =>
  Effect.flatMap(ActivityRepository, repository => repository.list({ order: 'desc', limit: RECENT_WORKOUTS })).pipe(
    Effect.map(history => indexPreviousLifts(history, new Set(exerciseIds))),
  );
