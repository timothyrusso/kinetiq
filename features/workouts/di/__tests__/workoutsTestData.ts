import { type Context, Effect, Layer } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { ExerciseSnapshotRepository } from '@/features/exercises';
import { Notifications } from '@/features/notifications';
import { WorkoutsTestLayer } from '@/features/workouts/di/__tests__/workoutsTestLayer';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import { ScreenWake } from '@/features/workouts/domain/services/ScreenWake';

/** A test runtime over `WorkoutsTestLayer`, as `renderWithLayer` hands it back. */
interface TestRuntime {
  readonly runPromise: <A, E>(
    effect: Effect.Effect<A, E, SqliteClient | ActivityRepository | RecordRepository | ExerciseSnapshotRepository>,
  ) => Promise<A>;
}

/**
 * Writes `workouts` to history and `records` to the records table on the test runtime, before a
 * ViewModel reads them: the seeding the ViewModel tests do, kept here because a `ui/` or
 * `facades/` test runs no Effect of its own.
 */
export const recordHistory = (
  runtime: TestRuntime,
  workouts: readonly CompletedWorkout[],
  records: readonly PersonalRecord[] = [],
) =>
  runtime.runPromise(
    Effect.gen(function* () {
      const activities = yield* ActivityRepository;
      yield* Effect.forEach(workouts, workout => activities.recordWorkout(workout, []), { discard: true });
      yield* (yield* RecordRepository).upsertBests(records);
    }),
  );

/** The workout `id` as history stores it now, or `undefined`. */
export const storedActivity = (runtime: TestRuntime, id: ActivityId) =>
  runtime.runPromise(Effect.flatMap(ActivityRepository, repository => repository.byId(id)));

/** The stored snapshot of exercise `id`, or `undefined`. */
export const storedSnapshot = (runtime: TestRuntime, id: string) =>
  runtime.runPromise(Effect.flatMap(ExerciseSnapshotRepository, repository => repository.byId(id)));

/** Makes every write of `operation` on `table` fail, as a full or locked disk would. */
export const refuseWrites = (runtime: TestRuntime, table: string, operation: 'INSERT' | 'DELETE') =>
  runtime.runPromise(
    Effect.flatMap(SqliteClient, db =>
      Effect.promise(() =>
        db.execAsync(
          `CREATE TRIGGER refuse_${operation.toLowerCase()} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT, 'refused'); END;`,
        ),
      ),
    ),
  );

type Request = Parameters<Context.Tag.Service<typeof Notifications>['schedule']>[0];

/**
 * `WorkoutsTestLayer` with a `Notifications` whose permission is granted and whose scheduler
 * holds what it was asked to post until it is retracted, for the rest alert. `scheduled` is what
 * the test reads; make one per test.
 */
export const makeRestAlertTestLayer = () => {
  const scheduled = new Map<string, Request>();
  let next = 0;
  const notifications = Layer.succeed(Notifications, {
    permission: Effect.succeed({ granted: true }),
    requestPermission: Effect.succeed({ granted: true }),
    schedule: request =>
      Effect.sync(() => {
        next += 1;
        const id = `alert-${next}`;
        scheduled.set(id, request);
        return id;
      }),
    cancel: id => Effect.sync(() => void scheduled.delete(id)),
    cancelAll: Effect.sync(() => scheduled.clear()),
    installHandler: Effect.void,
  });
  return { layer: Layer.merge(WorkoutsTestLayer, notifications), scheduled: scheduled as ReadonlyMap<string, Request> };
};

/**
 * {@link makeRestAlertTestLayer} with a `ScreenWake` that holds whether the screen is kept on, for
 * the live workout screen. `screen.awake` is what the test reads; make one per test.
 */
export const makeSessionScreenTestLayer = () => {
  const rest = makeRestAlertTestLayer();
  const screen = { awake: false };
  const wake = Layer.succeed(ScreenWake, {
    keepOn: Effect.sync(() => {
      screen.awake = true;
    }),
    release: Effect.sync(() => {
      screen.awake = false;
    }),
  });
  return {
    layer: Layer.merge(rest.layer, wake),
    scheduled: rest.scheduled,
    screen: screen as { readonly awake: boolean },
  };
};
