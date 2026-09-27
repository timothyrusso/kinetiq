import { Effect, Layer, PubSub } from 'effect';
import { advanceClock, collectLogs, itEffect } from '@/features/core/testing';
import { type Routine, RoutineEvents, RoutineId } from '@/features/routines';
import { updateSettings } from '@/features/settings';
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

function aWatch() {
  const pushes: SnapshotPush<Routine>[] = [];
  let onInbox: () => void = () => undefined;
  let onRequest: (requestId: string) => void = () => undefined;
  const link: WatchLink = {
    send: push => Effect.sync(() => void pushes.push(push)),
    onInboxChanged: listener =>
      Effect.sync(() => {
        onInbox = listener;
        return { remove: () => undefined };
      }),
    onSnapshotRequested: listener =>
      Effect.sync(() => {
        onRequest = listener;
        return { remove: () => undefined };
      }),
  };
  return { link, pushes, inboxChanged: () => onInbox(), requestSnapshot: (id: string) => onRequest(id) };
}
