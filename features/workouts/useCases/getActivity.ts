import { Effect } from 'effect';
import { ActivityNotFound } from '@/features/workouts/domain/errors/WorkoutsErrors';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';

/** Recorded workout `id`; one that is gone fails with `ActivityNotFound`. */
export const getActivity = (id: ActivityId) =>
  Effect.gen(function* () {
    const activity = yield* (yield* ActivityRepository).byId(id);
    if (activity === undefined) return yield* new ActivityNotFound({ activityId: id });
    return activity;
  });
