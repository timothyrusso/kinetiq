import { Deferred, Effect, Either, Ref } from 'effect';
import type { AppError } from '@/features/core/error';
import type { DrainReport } from '@/features/watch-sync/domain/entities/DrainReport';
import type { InboxItem } from '@/features/watch-sync/domain/entities/InboxItem';
import { InboxNotice } from '@/features/watch-sync/domain/services/InboxNotice';
import { type CompletedWorkout, WorkoutRecorder } from '@/features/workouts';

/** The finished watch workouts waiting on the phone. */
export interface InboxPort {
  /** Every entry waiting, oldest first. */
  readonly items: Effect.Effect<readonly InboxItem<CompletedWorkout>[], AppError>;
  /** The entry is saved: delete it. */
  readonly ack: (id: string) => Effect.Effect<void, AppError>;
  /** The entry can never be read: set it aside, never delete it. */
  readonly reject: (id: string) => Effect.Effect<void, AppError>;
}

interface DrainState {
  readonly running: Deferred.Deferred<DrainReport> | null;
  /** An entry may have landed while the running drain was reading: read once more. */
  readonly again: boolean;
}

/**
 * Saves the finished watch workouts waiting in `inbox`, one drain at a time: the launch, a return
 * to the foreground and an inbox event arriving mid-drain share the running drain, which then
 * reads the inbox once more. An entry leaves the inbox only when it is saved or was already saved
 * (`ack`), or can never be read (`reject`, which keeps the file). A save that fails, or a document
 * from a newer watch app, stays for the next drain: nothing is ever dropped. Newer-version entries
 * are told to the user once per launch, not on every drain.
 */
export const makeInboxDrain = (inbox: InboxPort) =>
  Effect.gen(function* () {
    const state = yield* Ref.make<DrainState>({ running: null, again: false });
    const reported = yield* Ref.make<ReadonlySet<string>>(new Set());

    const processItem = (item: InboxItem<CompletedWorkout>) =>
      Effect.gen(function* () {
        const notice = yield* InboxNotice;
        if (!item.read.ok) {
          if (item.read.reason === 'version') {
            const first = yield* Ref.modify(reported, seen =>
              seen.has(item.id) ? [false, seen] : [true, new Set([...seen, item.id])],
            );
            if (first) yield* notice.report('version');
            return Either.right(null);
          }
          yield* inbox.reject(item.id);
          yield* notice.report('invalid');
          return Either.right(null);
        }
        const recorder = yield* WorkoutRecorder;
        return yield* recorder.record(item.read.workout).pipe(
          Effect.map((activity): string | null => activity.id),
          Effect.catchTag('DuplicateWorkout', () => Effect.succeed(null)),
          Effect.tap(() => inbox.ack(item.id)),
          Effect.either,
        );
      });

    const drainPasses = Effect.gen(function* () {
      const saved: string[] = [];
      const failures: AppError[] = [];
      const pass = Effect.gen(function* () {
        yield* Ref.update(state, current => ({ ...current, again: false }));
        for (const item of yield* inbox.items) {
          const outcome = yield* processItem(item);
          if (Either.isLeft(outcome)) failures.push(outcome.left);
          else if (outcome.right !== null) saved.push(outcome.right);
        }
        return (yield* Ref.get(state)).again;
      });
      let again = true;
      while (again) {
        const result = yield* Effect.either(pass);
        if (Either.isLeft(result)) {
          failures.push(result.left);
          break;
        }
        again = result.right;
      }
      return { saved, failures } satisfies DrainReport;
    });

    return Effect.gen(function* () {
      const mine = yield* Deferred.make<DrainReport>();
      const running = yield* Ref.modify(state, current =>
        current.running === null
          ? [null, { running: mine, again: false }]
          : [current.running, { ...current, again: true }],
      );
      if (running !== null) return yield* Deferred.await(running);
      const report = yield* drainPasses.pipe(
        Effect.ensuring(Ref.update(state, current => ({ ...current, running: null }))),
      );
      yield* Deferred.succeed(mine, report);
      return report;
    });
  });
