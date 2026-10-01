import type { Logger } from '@timothyrusso/effect-core';
import { Effect, Fiber, Ref, Runtime } from 'effect';
import type { AppState } from '@/features/bootstrap/domain/entities/AppState';
import type { BootstrapOutcome } from '@/features/bootstrap/domain/entities/BootstrapOutcome';
import { LaunchEnvironment } from '@/features/bootstrap/domain/services/LaunchEnvironment';
import { AppConfig } from '@/features/core/config';
import { BackgroundSync } from '@/features/core/lifecycle';
import { logBackgroundFailure } from '@/features/core/logger';
import { SchemaStatus } from '@/features/core/sqlite';
import { ExerciseCatalog } from '@/features/exercises';
import { Notifications, TrainingReminder } from '@/features/notifications';
import { getSettings, hydrateSettings, SettingsRepository } from '@/features/settings';
import { SessionRepository, sessionLifecycle } from '@/features/workouts';

/** The reminder the settings ask for, made to match what is scheduled. Never delays the launch. */
const syncReminder = Effect.gen(function* () {
  const { reminder, notificationsEnabled } = getSettings();
  yield* (yield* TrainingReminder).sync(reminder, notificationsEnabled);
}).pipe(logBackgroundFailure('training reminder sync'));

/**
 * Follows the app in and out of the foreground. The workout clock sees every transition; a
 * return to the foreground also reconciles the reminder (the user may have changed the permission
 * in the OS) and syncs the watch.
 */
const installLifecycle = Effect.gen(function* () {
  const environment = yield* LaunchEnvironment;
  const sync = yield* BackgroundSync;
  const run = Runtime.runFork(yield* Effect.runtime<TrainingReminder | Logger>());
  const backgrounded = yield* Ref.make((yield* environment.appState) !== 'active');
  const changed = (next: AppState) =>
    Effect.gen(function* () {
      sessionLifecycle.appStateChanged(next);
      const wasAway = yield* Ref.getAndSet(backgrounded, next !== 'active');
      if (next !== 'active' || !wasAway) return;
      yield* Effect.all([syncReminder, sync.sync], { concurrency: 'unbounded', discard: true });
    });
  yield* environment.onAppStateChange(next => run(changed(next)));
});

/**
 * The launch, as one Effect, in the order the first frame needs it. It fails only when the app
 * cannot run; everything softer is logged where it happens and the launch carries on.
 *
 * 1. Storage: the runtime opened the database and ran the migrations before this runs; a failed
 *    migration is the fatal screen's, with its `SqlError`.
 * 2. Query plumbing, before anything can subscribe.
 * 3. The notification handler, before anything is scheduled.
 * 4. Settings into the store before the first component reads them, with the device's own answer
 *    about notifications; the chrome is painted from the same value.
 * 5. The two slow steps (fonts, header icons) overlap with the bundled catalog's install (on the
 *    first launch, and on the first launch of a build with a newer dataset) and the workout
 *    restore, and the first frame waits for them.
 * 6. Then, not awaited: the reminder, the watch sync and the app-state events. A workout open when the process died comes back paused, never running: the clock
 *    has been reading a stored value for hours the user did not train.
 */
export const runBootstrap = (systemDark: boolean) =>
  Effect.gen(function* () {
    const schema = yield* (yield* SchemaStatus).current;
    if (schema.migrationError !== null) return yield* schema.migrationError;
    yield* AppConfig.Config;

    const environment = yield* LaunchEnvironment;
    yield* environment.installQueryPlumbing;

    const notifications = yield* Notifications;
    yield* notifications.installHandler.pipe(logBackgroundFailure('notification handler install'));

    const stored = yield* (yield* SettingsRepository).load;
    const permission = yield* notifications.permission.pipe(
      Effect.catchAll(error =>
        Effect.fail(error).pipe(logBackgroundFailure('notification permission read'), Effect.as({ granted: false })),
      ),
    );
    const settings = { ...stored, notificationsGranted: permission.granted };
    hydrateSettings(settings);
    const launchTheme = settings.themeMode === 'system' ? (systemDark ? 'dark' : 'light') : settings.themeMode;
    yield* environment.paintChrome(launchTheme);

    const slowSteps = yield* Effect.fork(
      Effect.all([environment.loadFonts, environment.prefetchHeaderIcons], { concurrency: 'unbounded', discard: true }),
    );
    yield* (yield* ExerciseCatalog).installBundledIfNewer;
    const session = yield* (yield* SessionRepository).active.pipe(
      Effect.catchAll(error => Effect.fail(error).pipe(logBackgroundFailure('workout restore'), Effect.as(undefined))),
    );
    sessionLifecycle.restore(session ?? null);
    yield* Fiber.join(slowSteps);

    yield* Effect.forkDaemon(syncReminder);
    yield* (yield* BackgroundSync).install;
    if (session !== undefined) sessionLifecycle.pause();
    yield* installLifecycle;

    const outcome: BootstrapOutcome = {
      launchTheme,
      resumedWorkout: session !== undefined,
      fromVersion: schema.fromVersion,
      toVersion: schema.toVersion,
    };
    return outcome;
  });
