import { Effect } from 'effect';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';

/** Every recorded workout, newest first: the whole history, which Home draws grouped by week. */
export const listActivities = Effect.flatMap(ActivityRepository, repository => repository.list({ order: 'desc' }));
