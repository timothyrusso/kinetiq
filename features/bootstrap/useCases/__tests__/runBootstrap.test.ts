import { Effect, Layer } from 'effect';
import type { AppState } from '@/features/bootstrap/domain/entities/AppState';
import { LaunchEnvironment } from '@/features/bootstrap/domain/services/LaunchEnvironment';
import { runBootstrap } from '@/features/bootstrap/useCases/runBootstrap';
import { AppConfig } from '@/features/core/config';
import { SqlError, UnexpectedError } from '@/features/core/error';
import { BackgroundSync } from '@/features/core/lifecycle';
import { type SchemaReport, SchemaStatus } from '@/features/core/sqlite';
import { resetAllStores } from '@/features/core/state';
import { advanceClock, collectLogs, itEffect } from '@/features/core/testing';
import { ExerciseCatalog } from '@/features/exercises';
import { NotificationPermissionDenied, Notifications, TrainingReminder } from '@/features/notifications';
import { DEFAULT_SETTINGS, getSettings, SettingsRepository } from '@/features/settings';
import { ActivityId, SessionRepository } from '@/features/workouts';

const launch = {
  steps: [] as string[],
  painted: [] as string[],
  syncInstalls: 0,
  syncs: 0,
  appStateChanged: (_next: AppState): void => undefined,
};
let logs = collectLogs();

beforeEach(() => {
  resetAllStores();
  launch.steps = [];
  launch.painted = [];
  launch.syncInstalls = 0;
  launch.syncs = 0;
  logs = collectLogs();
});

const unused = () => Effect.die(new Error('not used by the launch'));

function testLayer(
  options: {
    readonly migrationError?: SqlError;
    readonly granted?: boolean | 'unreadable';
    readonly themeMode?: 'system' | 'light' | 'dark';
    readonly session?: 'none' | 'open' | 'unreadable';
    readonly fontsFail?: boolean;
    readonly catalogFails?: boolean;
  } = {},
) {
  const step = (name: string) => Effect.sync(() => void launch.steps.push(name));
  return Layer.mergeAll(
    schemaStatusOf({ fromVersion: 9, toVersion: 10, migrationError: options.migrationError ?? null }),
    AppConfig.layerOf({}),
    Layer.succeed(LaunchEnvironment, {
      installQueryPlumbing: step('queries'),
      loadFonts: options.fontsFail ? Effect.fail(new UnexpectedError({ cause: 'no font' })) : step('fonts'),
      prefetchHeaderIcons: step('icons'),
      paintChrome: mode => Effect.sync(() => void launch.painted.push(mode)).pipe(Effect.zipRight(step('chrome'))),
      appState: Effect.succeed<AppState>('active'),
      onAppStateChange: listener =>
        Effect.sync(() => {
          launch.appStateChanged = listener;
        }).pipe(Effect.zipRight(step('lifecycle'))),
    }),
    Layer.succeed(Notifications, {
      permission:
        options.granted === 'unreadable'
          ? Effect.fail(new NotificationPermissionDenied())
          : Effect.succeed({ granted: options.granted ?? false, canAsk: false }),
      requestPermission: unused(),
      openSettings: unused(),
      schedule: unused,
      cancel: unused,
      cancelAll: unused(),
      installHandler: Effect.void,
    }),
    Layer.succeed(TrainingReminder, { sync: () => Effect.succeed(null) }),
    Layer.succeed(SettingsRepository, {
      load: Effect.succeed({
        ...DEFAULT_SETTINGS,
        unitSystem: 'imperial' as const,
        themeMode: options.themeMode ?? 'system',
      }),
      save: unused,
    }),
    Layer.succeed(ExerciseCatalog, {
      installBundledIfNewer: options.catalogFails
        ? Effect.fail(new SqlError({ message: 'disk full' }))
        : Effect.succeed(false),
      find: unused,
      search: unused,
    }),
    Layer.succeed(SessionRepository, {
      save: unused,
      byId: unused,
      active:
        options.session === 'unreadable'
          ? Effect.fail(new SqlError({ message: 'sessions locked' }))
          : Effect.succeed(options.session === 'open' ? anOpenSession() : undefined),
      clearRest: unused,
      setStatus: unused,
      remove: unused,
    }),
    Layer.succeed(BackgroundSync, {
      install: Effect.sync(() => {
        launch.syncInstalls += 1;
      }),
      sync: Effect.sync(() => {
        launch.syncs += 1;
      }),
      push: unused(),
    }),
    Layer.suspend(() => logs.layer),
  );
}

function anOpenSession() {
  return {
    id: ActivityId.make('session-mbz1a2b3'),
    routineId: null,
    routineName: 'Push Day',
    startedAt: 1_750_000_000_000,
    elapsedSeconds: 600,
    status: 'active' as const,
    entries: [],
    activeIndex: 0,
    restEndsAt: null,
    restDurationSeconds: null,
    notes: null,
    updatedAt: 1_750_000_600_000,
  };
}

describe('runBootstrap', () => {
  itEffect(
    'fails with the migration SqlError before it sets anything up',
    Effect.gen(function* () {
      const result = yield* Effect.either(runBootstrap(true));

      expect(result._tag === 'Left' && result.left._tag).toBe('SqlError');
      expect(launch.steps).toEqual([]);
      expect(launch.syncInstalls).toBe(0);
    }),
    testLayer({ migrationError: new SqlError({ message: 'migrate to version 10' }) }),
  );

  itEffect(
    'puts the stored settings in the store with the device answer about notifications',
    Effect.gen(function* () {
      yield* runBootstrap(true);

      expect(getSettings().unitSystem).toBe('imperial');
      expect(getSettings().notificationsGranted).toBe(true);
    }),
    testLayer({ granted: true }),
  );

  itEffect(
    'counts a permission the device cannot read as not granted, and logs why',
    Effect.gen(function* () {
      yield* runBootstrap(true);

      expect(getSettings().notificationsGranted).toBe(false);
      expect(logs.entries.map(entry => entry.message)).toContain('notification permission read failed');
    }),
    testLayer({ granted: 'unreadable' }),
  );

  itEffect(
    'paints the chrome in the system theme when the setting follows the system',
    Effect.gen(function* () {
      const outcome = yield* runBootstrap(true);

      expect(outcome.launchTheme).toBe('dark');
      expect(launch.painted).toEqual(['dark']);
    }),
    testLayer(),
  );

  itEffect(
    'paints the chrome in the theme the user chose over the system one',
    Effect.gen(function* () {
      const outcome = yield* runBootstrap(true);

      expect(outcome.launchTheme).toBe('light');
      expect(launch.painted).toEqual(['light']);
    }),
    testLayer({ themeMode: 'light' }),
  );

  itEffect(
    'sets up the query plumbing, the fonts and the header icons in order',
    Effect.gen(function* () {
      yield* runBootstrap(true);

      expect(launch.steps).toEqual(['queries', 'chrome', 'fonts', 'icons', 'lifecycle']);
    }),
    testLayer(),
  );

  itEffect(
    'reports a workout open when the process died as resumed',
    Effect.gen(function* () {
      expect((yield* runBootstrap(true)).resumedWorkout).toBe(true);
    }),
    testLayer({ session: 'open' }),
  );

  itEffect(
    'carries on without a workout when it cannot be read, and logs why',
    Effect.gen(function* () {
      const outcome = yield* runBootstrap(true);

      expect(outcome.resumedWorkout).toBe(false);
      expect(logs.entries.map(entry => entry.message)).toContain('workout restore failed');
    }),
    testLayer({ session: 'unreadable' }),
  );

  itEffect(
    'fails when the fonts cannot load, installing nothing after them',
    Effect.gen(function* () {
      const result = yield* Effect.either(runBootstrap(true));

      expect(result._tag === 'Left' && result.left._tag).toBe('UnexpectedError');
      expect(launch.syncInstalls).toBe(0);
    }),
    testLayer({ fontsFail: true }),
  );

  itEffect(
    'fails when the bundled catalog cannot be installed on a first launch',
    Effect.gen(function* () {
      const result = yield* Effect.either(runBootstrap(true));

      expect(result._tag === 'Left' && result.left._tag).toBe('SqlError');
      expect(launch.syncInstalls).toBe(0);
    }),
    testLayer({ catalogFails: true }),
  );

  itEffect(
    'installs the background sync once the launch is through',
    Effect.gen(function* () {
      const outcome = yield* runBootstrap(true);

      expect(launch.syncInstalls).toBe(1);
      expect(outcome).toMatchObject({ fromVersion: 9, toVersion: 10 });
    }),
    testLayer(),
  );

  itEffect(
    'syncs the watch when the app comes back to the foreground, and not when it only goes inactive',
    Effect.gen(function* () {
      yield* runBootstrap(true);

      launch.appStateChanged('inactive');
      yield* advanceClock('1 millis');
      const whileInactive = launch.syncs;
      launch.appStateChanged('background');
      launch.appStateChanged('active');
      yield* advanceClock('1 millis');

      expect(whileInactive).toBe(0);
      expect(launch.syncs).toBe(1);
    }),
    testLayer(),
  );
});

function schemaStatusOf(report: SchemaReport) {
  return Layer.succeed(SchemaStatus, { current: Effect.succeed(report), remigrate: Effect.succeed(report) });
}
