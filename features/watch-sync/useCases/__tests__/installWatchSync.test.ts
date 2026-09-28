import { Effect, Layer, PubSub } from 'effect';
import { advanceClock, collectLogs, itEffect } from '@/features/core/testing';
import { type Routine, RoutineEvents, RoutineId } from '@/features/routines';
import { updateSettings } from '@/features/settings';
import { WatchUnavailable } from '@/features/watch-bridge';
import { aRoutine } from '@/features/watch-sync/__fixtures__/routines';
import type { DrainReport } from '@/features/watch-sync/domain/entities/DrainReport';
import type { SnapshotPush } from '@/features/watch-sync/domain/entities/SnapshotPush';
import { HistoryRefresh } from '@/features/watch-sync/domain/services/HistoryRefresh';
import { RoutineRepositoryFake } from '@/features/watch-sync/useCases/__tests__/routineRepositoryFake';
import { installWatchSync, type WatchLink } from '@/features/watch-sync/useCases/installWatchSync';

const changed = { routineId: RoutineId.make('rtn_1'), kind: 'saved' } as const;

describe('installWatchSync', () => {
  itEffect(
    'pushes once, half a second after a run of routine writes stops',
    Effect.gen(function* () {
      const watch = aWatch();
      yield* installWatchSync(watch.link, aDrain({ saved: [], failures: [] }));
      const events = yield* RoutineEvents;

      yield* PubSub.publish(events, changed);
      yield* advanceClock('200 millis');
      yield* PubSub.publish(events, changed);
      yield* advanceClock('499 millis');
      const before = watch.pushes.length;
      yield* advanceClock('1 millis');

      expect(before).toBe(0);
      expect(watch.pushes).toHaveLength(1);
    }),
    testLayer(),
  );

  itEffect(
    'pushes after the unit setting changes, in the new units',
    Effect.gen(function* () {
      const watch = aWatch();
      updateSettings({ unitSystem: 'metric' });
      yield* installWatchSync(watch.link, aDrain({ saved: [], failures: [] }));

      updateSettings({ unitSystem: 'imperial' });
      yield* advanceClock('500 millis');

      expect(watch.pushes.map(push => push.unitSystem)).toEqual(['imperial']);
    }),
    testLayer(),
  );

  itEffect(
    'answers the watch Sync button at once with a forced push naming the request',
    Effect.gen(function* () {
      const watch = aWatch();
      yield* installWatchSync(watch.link, aDrain({ saved: [], failures: [] }));

      watch.requestSnapshot('req-7');
      yield* advanceClock('1 millis');

      expect(watch.pushes.map(push => [push.force, push.requestId])).toEqual([[true, 'req-7']]);
    }),
    testLayer(),
  );

  itEffect(
    'drains the inbox when an entry arrives and refreshes the history when a workout was saved',
    Effect.gen(function* () {
      const watch = aWatch();
      yield* installWatchSync(watch.link, aDrain({ saved: ['watch-w1'], failures: [] }));

      watch.inboxChanged();
      yield* advanceClock('1 millis');

      expect(refreshes.count).toBe(1);
    }),
    testLayer(),
  );

  itEffect(
    'leaves the history alone when the drain saved nothing',
    Effect.gen(function* () {
      const watch = aWatch();
      yield* installWatchSync(watch.link, aDrain({ saved: [], failures: [] }));

      watch.inboxChanged();
      yield* advanceClock('1 millis');

      expect(refreshes.count).toBe(0);
    }),
    testLayer(),
  );
  itEffect(
    'subscribes once to each watch event when an install retried after a partial failure succeeds',
    Effect.gen(function* () {
      const watch = aWatch({ inboxFailures: 1 });
      const drain = aDrain({ saved: ['watch-w1'], failures: [] });
      const first = yield* Effect.either(installWatchSync(watch.link, drain));
      yield* installWatchSync(watch.link, drain);

      watch.requestSnapshot('req-8');
      watch.inboxChanged();
      yield* advanceClock('1 millis');

      expect(first._tag).toBe('Left');
      expect(watch.listeners()).toEqual({ inbox: 1, request: 1 });
      expect(watch.pushes).toHaveLength(1);
      expect(refreshes.count).toBe(1);
    }),
    testLayer(),
  );
});

const refreshes = { count: 0 };

beforeEach(() => {
  refreshes.count = 0;
});

function testLayer(routines: readonly Routine[] = [aRoutine()]) {
  return Layer.mergeAll(
    RoutineRepositoryFake(routines),
    Layer.effect(RoutineEvents, PubSub.unbounded()),
    Layer.succeed(HistoryRefresh, {
      afterWatchWorkouts: Effect.sync(() => {
        refreshes.count += 1;
      }),
    }),
    collectLogs().layer,
  );
}

function aDrain(report: DrainReport) {
  return Effect.succeed(report);
}

function aWatch({ inboxFailures = 0 } = {}) {
  const pushes: SnapshotPush<Routine>[] = [];
  const onInbox = new Set<() => void>();
  const onRequest = new Set<(requestId: string) => void>();
  let failuresLeft = inboxFailures;
  const subscribe = <L>(listeners: Set<L>, listener: L) =>
    Effect.sync(() => {
      listeners.add(listener);
      return { remove: () => void listeners.delete(listener) };
    });
  const link: WatchLink = {
    send: push => Effect.sync(() => void pushes.push(push)),
    onInboxChanged: listener =>
      Effect.suspend(() => {
        if (failuresLeft === 0) return subscribe(onInbox, listener);
        failuresLeft -= 1;
        return Effect.fail(new WatchUnavailable());
      }),
    onSnapshotRequested: listener => subscribe(onRequest, listener),
  };
  return {
    link,
    pushes,
    inboxChanged: () => {
      for (const listener of onInbox) listener();
    },
    requestSnapshot: (id: string) => {
      for (const listener of onRequest) listener(id);
    },
    listeners: () => ({ inbox: onInbox.size, request: onRequest.size }),
  };
}
