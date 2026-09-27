import { Effect, Layer } from 'effect';
import { getQueryClient } from '@/features/core/query';
import { HistoryRefresh } from '@/features/watch-sync/domain/services/HistoryRefresh';
import { invalidateAfterWatchWorkouts } from '@/features/workouts';

/** Invalidates the workouts' reads on the app's query client. */
export const HistoryRefreshLive = Layer.succeed(HistoryRefresh, {
  afterWatchWorkouts: Effect.sync(() => invalidateAfterWatchWorkouts(getQueryClient())),
});
