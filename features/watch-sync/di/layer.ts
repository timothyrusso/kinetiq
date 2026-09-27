import { Layer } from 'effect';
import { HistoryRefreshLive } from '@/features/watch-sync/data/services/historyRefreshLive';
import { InboxNoticeLive } from '@/features/watch-sync/data/services/inboxNoticeLive';
import { WatchBackgroundSyncLive } from '@/features/watch-sync/di/watchSyncLive';

/**
 * Every Layer `watch-sync` provides: the `BackgroundSync` the bootstrap installs, over the notice
 * store and the history refresh. The routines, the workouts and the watch bridge come from below.
 */
export const WatchSyncLive = WatchBackgroundSyncLive.pipe(
  Layer.provide(Layer.merge(HistoryRefreshLive, InboxNoticeLive)),
);
