import type { Logger } from '@timothyrusso/effect-core';
import { Effect, Queue, Runtime, Stream } from 'effect';
import type { AppError } from '@/features/core/error';
import { logBackgroundFailure } from '@/features/core/logger';
import { RoutineEvents, type RoutineRepository } from '@/features/routines';
import { getSettings, subscribeSettings } from '@/features/settings';
import type { DrainReport } from '@/features/watch-sync/domain/entities/DrainReport';
import { HistoryRefresh } from '@/features/watch-sync/domain/services/HistoryRefresh';
import {
  pushRoutineSnapshot,
  type SendSnapshot,
  type SnapshotRequest,
} from '@/features/watch-sync/useCases/pushRoutineSnapshot';

/** How long the routines must stay still before a push: an import of fifty routines sends one. */
const PUSH_DEBOUNCE = '500 millis';

/** Stops a listener. */
interface Subscription {
  readonly remove: () => void;
}

/** The watch as the sync drives it: pushes out, a drain in, and the events that trigger them. */
export interface WatchLink {
  readonly send: SendSnapshot;
  readonly onInboxChanged: (listener: () => void) => Effect.Effect<Subscription, AppError>;
  readonly onSnapshotRequested: (listener: (requestId: string) => void) => Effect.Effect<Subscription, AppError>;
}

/** Pushes the routines in the current unit setting, logging a failure: the watch is a mirror. */
export const pushNow = (link: WatchLink, request: SnapshotRequest = {}) =>
  pushRoutineSnapshot(link.send, getSettings().unitSystem, request).pipe(logBackgroundFailure('watch snapshot push'));

/**
 * Drains the inbox, refreshes the history when a workout was saved, and logs every failure it
 * kept an entry for.
 */
export const drainNow = <R>(drain: Effect.Effect<DrainReport, never, R>) =>
  Effect.gen(function* () {
    const report = yield* drain;
    if (report.saved.length > 0) yield* (yield* HistoryRefresh).afterWatchWorkouts;
    yield* Effect.forEach(report.failures, failure =>
      Effect.fail(failure).pipe(logBackgroundFailure('saving a watch workout')),
    );
  });

/**
 * Keeps the watch's copy of the routines current and saves what the watch finished. The phone
 * pushes after every routine write (debounced), when the unit setting changes, and when the
 * watch's Sync button asks; an arriving inbox entry drains the inbox. Nothing here can fail a
 * routine save or the launch: the triggers run on their own fibers, and each logs its failure.
 */
export const installWatchSync = <R>(link: WatchLink, drain: Effect.Effect<DrainReport, never, R>) =>
  Effect.gen(function* () {
    const run = Runtime.runFork(yield* Effect.runtime<R | RoutineRepository | HistoryRefresh | Logger>());
    // NOTE: the two bridge subscriptions first: they are the steps that can fail, and a failed
    // install is run again, which must not leave a second debounced push behind.
    yield* link.onSnapshotRequested(requestId => run(pushNow(link, { force: true, requestId })));
    yield* link.onInboxChanged(() => run(drainNow(drain)));

    const changes = yield* Queue.sliding<void>(1);
    yield* Stream.fromQueue(changes).pipe(
      Stream.debounce(PUSH_DEBOUNCE),
      Stream.runForEach(() => pushNow(link)),
      Effect.forkDaemon,
    );
    const events = yield* RoutineEvents;
    yield* Stream.fromPubSub(events).pipe(
      Stream.runForEach(() => Queue.offer(changes, undefined)),
      Effect.forkDaemon,
    );
    let unitSystem = getSettings().unitSystem;
    subscribeSettings(() => {
      const next = getSettings().unitSystem;
      if (next === unitSystem) return;
      unitSystem = next;
      Queue.unsafeOffer(changes, undefined);
    });
  });
