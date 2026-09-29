import { Effect, Fiber, Layer } from 'effect';
import { SqlError, UnexpectedError } from '@/features/core/error';
import { itEffect } from '@/features/core/testing';
import type { InboxItem } from '@/features/watch-sync/domain/entities/InboxItem';
import type { WatchInboxProblem } from '@/features/watch-sync/domain/entities/WatchInboxProblem';
import { InboxNotice } from '@/features/watch-sync/domain/services/InboxNotice';
import { type InboxPort, makeInboxDrain } from '@/features/watch-sync/useCases/drainInbox';
import {
  type Activity,
  ActivityId,
  type CompletedWorkout,
  DuplicateWorkout,
  WorkoutRecorder,
} from '@/features/workouts';

describe('makeInboxDrain', () => {
  itEffect(
    'records a readable workout, acks its entry and reports its activity id',
    Effect.gen(function* () {
      const inbox = anInbox([aWorkoutItem('w1')]);
      const drain = yield* makeInboxDrain(inbox.port);

      const report = yield* drain;

      expect(report).toEqual({ saved: ['watch-w1'], failures: [] });
      expect(inbox.waiting()).toEqual([]);
      expect(recorded.map(workout => workout.id)).toEqual(['watch-w1']);
    }),
    testLayer(),
  );

  itEffect(
    'acks a workout already in history without reporting it as saved',
    Effect.gen(function* () {
      const inbox = anInbox([aWorkoutItem('w1')]);
      const drain = yield* makeInboxDrain(inbox.port);

      const report = yield* drain;

      expect(report.saved).toEqual([]);
      expect(inbox.waiting()).toEqual([]);
    }),
    testLayer({ duplicates: ['watch-w1'] }),
  );

  itEffect(
    'keeps a workout whose save failed for the next drain and reports the failure',
    Effect.gen(function* () {
      const inbox = anInbox([aWorkoutItem('w1')]);
      const drain = yield* makeInboxDrain(inbox.port);

      const report = yield* drain;

      expect(report.saved).toEqual([]);
      expect(report.failures.map(failure => failure._tag)).toEqual(['SqlError']);
      expect(inbox.waiting()).toEqual(['w1']);
      expect(inbox.rejected).toEqual([]);
    }),
    testLayer({ failSaves: true }),
  );

  itEffect(
    'keeps a newer-version workout for an app update and tells the user once over two drains',
    Effect.gen(function* () {
      const inbox = anInbox([{ id: 'w2', read: { ok: false, reason: 'version' } }]);
      const drain = yield* makeInboxDrain(inbox.port);

      yield* drain;
      yield* drain;

      expect(inbox.waiting()).toEqual(['w2']);
      expect(inbox.rejected).toEqual([]);
      expect(notices).toEqual(['version']);
    }),
    testLayer(),
  );

  itEffect(
    'sets an unreadable workout aside, tells the user, and records nothing',
    Effect.gen(function* () {
      const inbox = anInbox([
        { id: 'bad', read: { ok: false, reason: 'invalid' } },
        { id: 'bounds', read: { ok: false, reason: 'invalid' } },
      ]);
      const drain = yield* makeInboxDrain(inbox.port);

      yield* drain;

      expect(inbox.rejected).toEqual(['bad', 'bounds']);
      expect(notices).toEqual(['invalid', 'invalid']);
      expect(recorded).toEqual([]);
    }),
    testLayer(),
  );

  itEffect(
    'shares the running drain with a second call and reads the inbox once more for it',
    Effect.gen(function* () {
      const inbox = anInbox([aWorkoutItem('w1')], { delayFirstRead: true });
      const drain = yield* makeInboxDrain(inbox.port);

      const first = yield* Effect.fork(drain);
      yield* Effect.yieldNow();
      const second = yield* Effect.fork(drain);
      inbox.releaseFirstRead();
      const [one, two] = [yield* Fiber.join(first), yield* Fiber.join(second)];

      expect(two).toBe(one);
      expect(inbox.reads()).toBe(2);
      expect(one.saved).toEqual(['watch-w1']);
    }),
    testLayer(),
  );

  itEffect(
    'ends the drain with the failure when the inbox cannot be read, saving nothing',
    Effect.gen(function* () {
      const inbox = anInbox([aWorkoutItem('w1')], { failReads: true });
      const drain = yield* makeInboxDrain(inbox.port);

      const report = yield* drain;

      expect(report.saved).toEqual([]);
      expect(report.failures.map(failure => failure._tag)).toEqual(['UnexpectedError']);
      expect(recorded).toEqual([]);
    }),
    testLayer(),
  );
});

const recorded: CompletedWorkout[] = [];
const notices: WatchInboxProblem[] = [];

beforeEach(() => {
  recorded.length = 0;
  notices.length = 0;
});

function testLayer(options: { readonly duplicates?: readonly string[]; readonly failSaves?: boolean } = {}) {
  return Layer.mergeAll(
    Layer.succeed(WorkoutRecorder, {
      record: workout => {
        if (options.failSaves) return Effect.fail(new SqlError({ message: 'disk full' }));
        if (options.duplicates?.includes(workout.id)) {
          return Effect.fail(new DuplicateWorkout({ activityId: workout.id }));
        }
        return Effect.sync(() => {
          recorded.push(workout);
          return anActivity(workout.id);
        });
      },
    }),
    Layer.succeed(InboxNotice, { report: problem => Effect.sync(() => void notices.push(problem)) }),
  );
}

function anInbox(
  items: InboxItem<CompletedWorkout>[],
  options: { readonly delayFirstRead?: boolean; readonly failReads?: boolean } = {},
) {
  const waiting = new Map(items.map(item => [item.id, item]));
  const rejected: string[] = [];
  let reads = 0;
  let release: () => void = () => undefined;
  const firstRead = new Promise<void>(resolve => {
    release = resolve;
  });
  const port: InboxPort = {
    items: Effect.gen(function* () {
      reads += 1;
      if (options.failReads) return yield* new UnexpectedError({ cause: new Error('native inbox') });
      if (options.delayFirstRead && reads === 1) yield* Effect.promise(() => firstRead);
      return [...waiting.values()];
    }),
    ack: id => Effect.sync(() => void waiting.delete(id)),
    reject: id =>
      Effect.sync(() => {
        waiting.delete(id);
        rejected.push(id);
      }),
  };
  return { port, rejected, waiting: () => [...waiting.keys()], reads: () => reads, releaseFirstRead: () => release() };
}

function aWorkoutItem(uuid: string): InboxItem<CompletedWorkout> {
  return {
    id: uuid,
    read: {
      ok: true,
      workout: {
        id: ActivityId.make(`watch-${uuid}`),
        routineId: 'rtn_1',
        title: 'Push',
        startedAt: 1_758_794_400_000,
        endedAt: 1_758_797_100_000,
        durationSeconds: 2700,
        entries: [],
        totalVolumeKg: 0,
        totalSets: 0,
        notes: null,
      },
    },
  };
}

function anActivity(id: ActivityId): Activity {
  return {
    id,
    kind: 'lift',
    title: 'Push',
    startedAt: 1_758_794_400_000,
    durationSeconds: 2700,
    notes: null,
    sourceSessionId: null,
    strength: { entries: [], totalVolumeKg: 0, totalSets: 0, personalRecords: [] },
  };
}
