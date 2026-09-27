import { Clock, Effect } from 'effect';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { summariseTraining, trainingHeatmap, windowStart } from '@/features/workouts/domain/utils/trainingSummary';

/**
 * The summary of the last `rangeWeeks` weeks, this one included. One read for the whole window
 * rather than one per week, and the window's start is derived from the clock inside, so the same
 * cache slot recomputes against the current day.
 */
export const trainingSummary = (rangeWeeks: number) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const repository = yield* ActivityRepository;
    const activities = yield* repository.list({ from: windowStart(now, rangeWeeks), order: 'desc' });
    const recorded = yield* repository.count;
    return summariseTraining(activities, recorded, rangeWeeks, now);
  });

/** Minutes trained per day over the last `weeks` weeks, for the training grid. */
export const trainingGrid = (weeks: number) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const activities = yield* (yield* ActivityRepository).list({ from: windowStart(now, weeks), order: 'asc' });
    return trainingHeatmap(activities, weeks, now);
  });
