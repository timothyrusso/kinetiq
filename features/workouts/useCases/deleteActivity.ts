import { Effect } from 'effect';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';

/** Deletes recorded workout `id`. The records it set stay: a record is a claim about a best. */
export const deleteActivity = (id: ActivityId) =>
  Effect.flatMap(ActivityRepository, repository => repository.remove(id));
