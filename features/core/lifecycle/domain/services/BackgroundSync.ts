import { Context, type Effect } from 'effect';

/**
 * Work that mirrors the app's data somewhere else and runs on its own triggers: the Apple Watch
 * sync. Declared here so the bootstrap can install it and the feature that does it can provide
 * it, although the two are peers. Every call succeeds: a sync that fails logs and waits for its
 * next trigger.
 */
export class BackgroundSync extends Context.Tag('core/lifecycle/BackgroundSync')<
  BackgroundSync,
  {
    /** Subscribes the sync to its triggers and runs it once. Called once, after the migrations. */
    readonly install: Effect.Effect<void>;
    /** Runs it now: the app is back in the foreground, or the data changed under it. */
    readonly sync: Effect.Effect<void>;
  }
>() {}
