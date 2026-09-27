import { Context, type Effect } from 'effect';

/** Refreshes every read that shows the history, after workouts arrived from the watch. */
export class HistoryRefresh extends Context.Tag('watch-sync/HistoryRefresh')<
  HistoryRefresh,
  { readonly afterWatchWorkouts: Effect.Effect<void> }
>() {}
