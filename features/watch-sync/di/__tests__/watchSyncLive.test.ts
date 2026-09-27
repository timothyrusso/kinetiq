import { Effect, Layer, PubSub } from 'effect';
import { BackgroundSync } from '@/features/core/lifecycle';
import { advanceClock, collectLogs, itEffect } from '@/features/core/testing';
import { RoutineEvents } from '@/features/routines';
import { WatchBridge, WatchUnavailable } from '@/features/watch-bridge';
import { aRoutine } from '@/features/watch-sync/__fixtures__/routines';
import { WatchBackgroundSyncLive } from '@/features/watch-sync/di/watchSyncLive';
import { HistoryRefresh } from '@/features/watch-sync/domain/services/HistoryRefresh';
import { InboxNotice } from '@/features/watch-sync/domain/services/InboxNotice';
import { RoutineRepositoryFake } from '@/features/watch-sync/useCases/__tests__/routineRepositoryFake';
import { WorkoutRecorder } from '@/features/workouts';

const watch = { pushes: 0, inboxReads: 0, subscriptions: 0, refuseNextSubscription: false };

beforeEach(() => {
  watch.pushes = 0;
  watch.inboxReads = 0;
  watch.subscriptions = 0;
  watch.refuseNextSubscription = false;
});

const unused = () => Effect.die(new Error('not used by the watch sync'));

const subscribe = () =>
  Effect.suspend(() => {
    if (watch.refuseNextSubscription) {
      watch.refuseNextSubscription = false;
      return Effect.fail(new WatchUnavailable());
    }
    watch.subscriptions += 1;
    return Effect.succeed({ remove: () => undefined });
  });

describe('WatchBackgroundSyncLive', () => {
  itEffect(
    'pushes the routines on push without reading the watch inbox',
    Effect.gen(function* () {
      yield* (yield* BackgroundSync).push;

      expect(watch.pushes).toBe(1);
      expect(watch.inboxReads).toBe(0);
    }),
    testLayer(),
  );

  itEffect(
    'subscribes to the watch once when installed twice',
    Effect.gen(function* () {
      const sync = yield* BackgroundSync;

      yield* sync.install;
      yield* sync.install;

      expect(watch.subscriptions).toBe(2);
    }),
    testLayer(),
  );

  itEffect(
    'tries an install that failed again on the next install',
    Effect.gen(function* () {
      const sync = yield* BackgroundSync;
      watch.refuseNextSubscription = true;

      yield* sync.install;
      const afterFailure = watch.subscriptions;
      yield* sync.install;

      expect(afterFailure).toBe(0);
      expect(watch.subscriptions).toBe(2);
    }),
    testLayer(),
  );

  itEffect(
    'does nothing on a device without a watch bridge',
    Effect.gen(function* () {
      const sync = yield* BackgroundSync;

      yield* sync.install;
      yield* sync.push;
      yield* sync.sync;
      yield* advanceClock('1 second');

      expect([watch.pushes, watch.inboxReads, watch.subscriptions]).toEqual([0, 0, 0]);
    }),
    testLayer({ supported: false }),
  );
});

function testLayer({ supported = true }: { readonly supported?: boolean } = {}) {
  const bridge = Layer.succeed(WatchBridge, {
    isSupported: Effect.succeed(supported),
    pushSnapshot: () =>
      Effect.sync(() => {
        watch.pushes += 1;
      }),
    listInbox: Effect.sync(() => {
      watch.inboxReads += 1;
      return [];
    }),
    ackInbox: unused,
    rejectInbox: unused,
    onInboxChanged: subscribe,
    onSnapshotRequested: subscribe,
  });
  const services = Layer.mergeAll(
    bridge,
    RoutineRepositoryFake([aRoutine()]),
    Layer.effect(RoutineEvents, PubSub.unbounded()),
    Layer.succeed(WorkoutRecorder, { record: unused }),
    Layer.succeed(InboxNotice, { report: () => Effect.void }),
    Layer.succeed(HistoryRefresh, { afterWatchWorkouts: Effect.void }),
    collectLogs().layer,
  );
  return WatchBackgroundSyncLive.pipe(Layer.provideMerge(services));
}
