import type { Logger } from '@timothyrusso/effect-core';
import { Effect, Layer, Ref } from 'effect';
import { toAppError } from '@/features/core/error';
import { BackgroundSync } from '@/features/core/lifecycle';
import { logBackgroundFailure } from '@/features/core/logger';
import type { RoutineEvents, RoutineRepository } from '@/features/routines';
import { WatchBridge } from '@/features/watch-bridge';
import { readInboxEntry } from '@/features/watch-sync/data/adapters/readInboxEntry';
import { snapshotPushOf } from '@/features/watch-sync/data/adapters/snapshotPushOf';
import type { HistoryRefresh } from '@/features/watch-sync/domain/services/HistoryRefresh';
import type { InboxNotice } from '@/features/watch-sync/domain/services/InboxNotice';
import { makeInboxDrain } from '@/features/watch-sync/useCases/drainInbox';
import { drainNow, installWatchSync, pushNow, type WatchLink } from '@/features/watch-sync/useCases/installWatchSync';
import type { WorkoutRecorder } from '@/features/workouts';

type SyncServices = RoutineRepository | RoutineEvents | WorkoutRecorder | InboxNotice | HistoryRefresh | Logger;

/**
 * `BackgroundSync` for the Apple Watch, over `WatchBridge`. Without a watch bridge (Android, a
 * build without the native module) every call does nothing. Installing twice (a launch retried
 * after a failure) subscribes once; an install that failed is tried again by the next one.
 */
export const WatchBackgroundSyncLive = Layer.effect(
  BackgroundSync,
  Effect.gen(function* () {
    const bridge = yield* WatchBridge;
    const services = yield* Effect.context<SyncServices>();
    const supported = yield* bridge.isSupported;
    const link: WatchLink = {
      send: push =>
        Effect.try({ try: () => snapshotPushOf(push), catch: cause => toAppError(cause) }).pipe(
          Effect.flatMap(bridge.pushSnapshot),
        ),
      onInboxChanged: bridge.onInboxChanged,
      onSnapshotRequested: bridge.onSnapshotRequested,
    };
    const drain = yield* makeInboxDrain({
      items: Effect.map(bridge.listInbox, entries => entries.map(readInboxEntry)),
      ack: bridge.ackInbox,
      reject: bridge.rejectInbox,
    });
    const installed = yield* Ref.make(false);
    const sync = Effect.all([pushNow(link), drainNow(drain)], { concurrency: 'unbounded', discard: true });

    return BackgroundSync.of({
      install: Effect.gen(function* () {
        if (!supported || (yield* Ref.get(installed))) return;
        yield* installWatchSync(link, drain);
        yield* Ref.set(installed, true);
        yield* Effect.forkDaemon(sync);
      }).pipe(logBackgroundFailure('watch sync install'), Effect.provide(services)),
      sync: supported ? sync.pipe(Effect.provide(services)) : Effect.void,
      push: supported ? pushNow(link).pipe(Effect.provide(services)) : Effect.void,
    });
  }),
);
