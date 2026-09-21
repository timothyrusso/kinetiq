/**
 * Application bootstrap: every imperative step that has to be true before the
 * first frame is worth drawing, kept out of the component file so the ordering can
 * be reviewed as a list.
 *
 * ## The constraint that shapes the order
 *
 * An error boundary cannot catch what `useEffect` throws. Effects run after commit,
 * so their errors reach the global handler: on a dev build a red box over a
 * half-built UI, on a production build a logged error and an app that keeps
 * rendering something wrong. Bootstrap therefore cannot be "run some effects and
 * hope". It is one async function that either returns or rejects, and a component
 * that renders either its children or an error screen. Reliability being priority
 * number one is the literal reason this file exists.
 *
 * ## Ordering rules
 *
 * 1. **Database first.** Almost everything downstream reads from it, and opening it
 *    runs the migrations: the only step that can permanently change on-disk state,
 *    so it is deliberately the earliest thing allowed to fail.
 * 2. **Config before consumers.** The exercise provider is configured before any
 *    query can run, and the query adapters are installed before the first subscriber
 *    attaches. Installing them after the first mount would leave the app's first
 *    screen without focus/online wiring: precisely the bug that shows up as "why is
 *    it refetching when I switch tabs".
 * 3. **Cheap before expensive.** Fonts and the first-run seed are the two slow steps,
 *    and nothing downstream awaits them, so they overlap with each other and with
 *    everything after rather than serialising in front.
 * 4. **Never block the UI on the network.** Nothing here awaits a request. The
 *    connectivity probe runs concurrently and publishes into a store, so the UI can
 *    draw a skeleton while `known === false` instead of waiting for an answer.
 * 5. **Device truth is read, not assumed.** The notification permission is fetched
 *    during bootstrap because the user may have changed it in the OS while the app
 *    was closed, and everything downstream reads the store rather than asking again.
 *
 * Steps that merely *should* happen and cannot break the app: the notification
 * handler, the reminder schedule, interrupted-recording recovery: catch in place,
 * so one absent native module never becomes a fatal startup error.
 */
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { getLocales } from 'expo-localization';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { configureExerciseProvider } from '@/api';
import { loadAppFonts } from '@/fonts';
import { openDatabase, readAllSettings, SETTING_KEYS, type DatabaseOpenResult, type SettingKey } from '@/persistence';
import { seedIfEmpty } from '@/seed/seed';
import { installQueryAdapters } from '@/query/client';
import { startNetworkStatus } from '@/query/networkStatus';
import { recorder } from '@/services/location';
import {
  installNotificationHandler,
  readNotificationPermission,
  syncTrainingReminder,
} from '@/services/notifications';
import { setHapticsEnabled } from '@/services/haptics';
import { getSettings, hydrateSettings } from '@/settings';
import { normaliseSettings, type SettingsState } from '@/settings/types';
import { themeFor } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { Txt } from '@/ui/Text';
import { handleAppState, hydrateWorkoutSession, pauseSession } from '@/workout/session';

export type SeedSummary = {
  activities: number;
  routines: number;
  exercises: number;
  records: number;
  firstActivityAt: number;
};

/**
 * `launchTheme` is a launch-time reading kept for the diagnostics row only. Nothing
 * should branch on it: it goes stale the moment the OS flips appearance while the
 * app is open, and `useAppTheme()` already derives the live answer from
 * `useColorScheme()`. Keeping a second source of truth for the theme here would be
 * the beginning of a whole family of "dark app, light status bar" bugs.
 */
export type BootstrapOutcome = {
  /** What the database actually did, surfaced on the settings screen's diagnostics row. */
  database: DatabaseOpenResult;
  settings: SettingsState;
  /** The theme the launch chrome was painted with. Diagnostics only: do not branch on it. */
  launchTheme: 'light' | 'dark';
  /** Rows created by the first-run seed, or null when the database already had data. */
  seeded: SeedSummary | null;
  /** True when migrations reported a problem but the app is still usable. */
  migrationFailed: boolean;
  /** A workout was open when the process died and has come back paused. */
  resumedWorkout: boolean;
};

/**
 * Longest the splash may stay up before we show the app anyway. A real cold start
 * here is ~600ms (fonts dominate); five seconds is not generosity, it is the point
 * at which something is genuinely wedged: an unavailable storage service, a disk
 * stall: and a spinner that never ends is a worse failure than a UI that renders
 * and then shows per-feature error states.
 */
export const BOOTSTRAP_DEADLINE_MS = 5_000;

/** The keys that make up `SettingsState`. Order is irrelevant: they are read by key. */
const SETTINGS_KEYS = [
  SETTING_KEYS.unitSystem,
  SETTING_KEYS.themeMode,
  SETTING_KEYS.language,
  SETTING_KEYS.haptics,
  SETTING_KEYS.notifications,
  SETTING_KEYS.defaultRestSeconds,
  SETTING_KEYS.autoStartRest,
  SETTING_KEYS.weeklyGoalWorkouts,
  SETTING_KEYS.showSpeedInsteadOfPace,
  SETTING_KEYS.profile,
  SETTING_KEYS.reminder,
] as const;

export function createSplashController(): { preventAutoHide: () => void; hide: () => void } {
  return {
    preventAutoHide: () => {
      try {
        // Unawaited on purpose. Awaiting at module scope would put a promise
        // rejection in front of React's own error handling. This build of
        // expo-splash-screen takes no options: the hide animation is whatever the
        // native splash declares in app.json, which is also why the config there
        // matters more than anything set here.
        void SplashScreen.preventAutoHideAsync();
      } catch {
        // No native splash to hold. Carry on.
      }
    },
    hide: () => {
      try {
        void SplashScreen.hideAsync();
      } catch {
        // Already hidden, or never existed.
      }
    },
  };
}

/**
 * Paints the native chrome to match the *resolved* theme, never the preference:
 * 'system' against a light OS would otherwise get a dark root view behind a light
 * app, which reads as a flash of dark at launch and in the rounded screen corners.
 *
 * The Android navigation buttons are left alone deliberately. Since Android 10 the
 * system enforces contrast for the gesture pill against the window background, which
 * the root colour above already sets; the module that would override that
 * (`expo-navigation-bar`) is not worth a native dependency for a control the OS
 * already gets right in both themes.
 */
export function applyNativeChrome(resolved: 'light' | 'dark'): void {
  try {
    void NavigationBar.setBackgroundColorAsync(themeFor(resolved).brandBackground);
    StatusBar.setStyle(resolved === 'dark' ? 'light' : 'dark', true);
  } catch {
    // Cosmetic only; an app that refuses this is still a usable app.
  }
}

/**
 * One batched read of every setting, folded back into `SettingsState`.
 *
 * Ten separate key reads would be ten transactions at the worst possible moment:
 * before the first frame. Values are read positionally against a fixed list rather
 * than by `Map` iteration order, which a partial result would otherwise silently
 * misalign.
 */
export async function readSettingsSnapshot(): Promise<SettingsState> {
  // Typed as the wide key union rather than the literal tuple so the positional
  // lookup below is a `SettingKey` read and not `SettingKey | ''`.
  const keys: SettingKey[] = [...SETTINGS_KEYS];
  const values = await readAllSettings(keys);

  // Read by KEY, not by position. This was `at(0)`, `at(1)`, `at(2)`, indexed into the key
  // array, which means inserting a setting anywhere but the end silently reassigns every field
  // after it: adding `language` in second place would have loaded the theme into
  // `hapticsEnabled` and shifted the rest down one. Nothing would have failed to compile,
  // because the casts were already lying about the types.
  //
  // `normaliseSettings` drops undefined keys, so an unset or unparseable row falls back to its
  // default instead of becoming `undefined as boolean` in the store.
  const settings = normaliseSettings({
    unitSystem: values.get(SETTING_KEYS.unitSystem) as SettingsState['unitSystem'],
    themeMode: values.get(SETTING_KEYS.themeMode) as SettingsState['themeMode'],
    language: values.get(SETTING_KEYS.language) as SettingsState['language'],
    hapticsEnabled: values.get(SETTING_KEYS.haptics) as boolean,
    notificationsEnabled: values.get(SETTING_KEYS.notifications) as boolean,
    defaultRestSeconds: values.get(SETTING_KEYS.defaultRestSeconds) as number,
    autoStartRest: values.get(SETTING_KEYS.autoStartRest) as boolean,
    weeklyGoalWorkouts: values.get(SETTING_KEYS.weeklyGoalWorkouts) as number,
    showSpeedInsteadOfPace: values.get(SETTING_KEYS.showSpeedInsteadOfPace) as boolean,
    profile: values.get(SETTING_KEYS.profile) as SettingsState['profile'],
    reminder: values.get(SETTING_KEYS.reminder) as SettingsState['reminder'],
  });

  // Device truth, not the user's preference. Two separate flags by design: the
  // switch in Settings means "I want these", this means "the OS is letting us", and
  // conflating them is how an app ends up claiming notifications are on when they
  // are not. A denial never blocks anything: the rest timer keeps counting on
  // screen, it just goes quietly.
  const permission = await readNotificationPermission();

  return { ...settings, notificationsGranted: permission.granted };
}

/**
 * The ordered sequence. Throws when the app genuinely cannot run; everything softer
 * than that is caught where it happens.
 */
export async function runBootstrap(systemDark: boolean): Promise<BootstrapOutcome> {
  // 1. Storage. If this fails there is nothing to build on and the caller shows the
  //    fatal screen.
  const database = await openDatabase();

  // 2. Language, then the provider that consumes it. `getLocales()` is synchronous
  //    and safe before any mount, which is what lets this sit here at all.
  configureExerciseProvider({
    // `?? undefined` because a locale record can carry a null languageCode and the
    // port's contract is `string | undefined`; the provider treats undefined as
    // "no translation preference" rather than as a language called "null".
    getLanguageCode: () => getLocales()[0]?.languageCode ?? undefined,
  });

  // 3. Query plumbing, before anything can subscribe. The disposers are dropped
  //    deliberately: these are process-lifetime singletons and there is no second
  //    bootstrap to tear them down for.
  void startNetworkStatus();
  void installQueryAdapters();

  // 4. The handler must exist before any notification can be scheduled: including
  //    the reminder two steps down.
  installNotificationHandler();

  // 5. Settings, into the store, before the first component reads them. The chrome is
  //    painted from the same folded value the store is about to hold, so the two can
  //    never disagree about what colour this launch was.
  const settings = await readSettingsSnapshot();
  hydrateSettings(settings);
  setHapticsEnabled(settings.hapticsEnabled);
  const launchTheme =
    settings.themeMode === 'system' ? (systemDark ? 'dark' : 'light') : settings.themeMode;
  applyNativeChrome(launchTheme);

  // 6. The two slow steps, overlapped with each other and with everything after.
  const fontsLoaded = loadAppFonts();
  const seeded = await seedIfEmpty();

  // 7. Active-workout restoration and the interrupted-recording draft. Both settle
  //    *before* the first frame so the "resume" affordance ships with the launch
  //    instead of popping in 300ms later.
  const session = await hydrateWorkoutSession();
  await recorder.hydrate().catch(() => undefined);

  // 8. Fonts are the only thing from step 6 the first frame genuinely needs, so that
  //    is what the splash waits on.
  await fontsLoaded;

  // 9. Reconcile the reminder schedule with reality, including the case where the
  //    user revoked permission in the OS while the app was closed. Not awaited: a
  //    device with no notification support must not delay the launch.
  void syncTrainingReminder(settings.reminder, settings.notificationsEnabled).catch(
    () => undefined,
  );

  // A workout that was open when the process died comes back *paused*, never
  // running: the clock in the app has been reading the stored value for hours that
  // the user did not train, so letting it keep counting would bank time that never
  // happened. `beginTick()` is accurate (it restarts `lastTickAt` from *now*, so
  // there is no phantom gap), but an auto-running timer is still a lie about intent
  //: one tap to resume is the correct cost. This is deliberately `pauseSession()`
  // and not `handleAppState('background')`: that function is idempotent for a
  // restore, and using it here would read like it mattered while doing nothing.
  if (session) pauseSession();

  return {
    database,
    settings,
    launchTheme,
    seeded,
    migrationFailed: database.migrationError !== undefined,
    resumedWorkout: session !== null,
  };
}

/**
 * The AppState wiring. Separate from `runBootstrap` because it is a subscription
 * with a disposer, and because "did we just come back?" is worth being able to read
 * on its own.
 */
export function installAppLifecycle(): () => void {
  let backgrounded = AppState.currentState !== 'active';

  const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    // 'unknown' and 'extension' are real AppStateStatus values the session store has
    // no opinion about. Both mean "not the foreground, do not bank time", which is
    // exactly what the background branch does: so collapsing them is behaviour, not
    // a cast.
    handleAppState(next === 'active' || next === 'inactive' ? next : 'background');

    // Reconciling on every return to the foreground is how the app survives the user
    // changing OS-level permissions without ever opening Settings in-app. Two cheap
    // native calls, on a transition only. Settings are read at call time: capturing
    // them at mount would schedule against a reminder edited since.
    if (next === 'active' && backgrounded) {
      const current = getSettings();
      void syncTrainingReminder(current.reminder, current.notificationsEnabled).catch(
        () => undefined,
      );
    }
    backgrounded = next !== 'active';
  });

  return () => subscription.remove();
}

/**
 * The launch screen: the last thing drawn before the app is, in both directions.
 *
 * Not a spinner on a blank page: the wordmark sits on the *exact* canvas colour the
 * app will use in this theme, which is what makes the splash cross-fade read as one
 * continuous surface rather than a handoff. The indicator is the native one on
 * purpose: a custom mark would need fonts, and the fonts are the thing still
 * loading.
 */
export function LaunchScreen({ dark }: { dark: boolean }) {
  const theme = themeFor(dark ? 'dark' : 'light');
  return (
    <View style={[styles.launch, { backgroundColor: theme.brandBackground }]}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <Txt variant="label" tone="muted" tracking={1.4} uppercase>
        Kinetiq
      </Txt>
    </View>
  );
}

/**
 * The wrapper that must exist exactly once, above everything: the gesture root.
 * Sheets, the tab bar's travelling indicator and every chart's scrubbing handler
 * dead-end without it, and on Android the failure is silent. The background colour is
 * set here rather than per-screen so overscroll and the rounded screen corners reveal
 * the canvas, never white.
 */
export function GestureRoot({
  children,
  canvasColor,
}: {
  children: React.ReactNode;
  canvasColor: string;
}) {
  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: canvasColor }]}>
      {children}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  launch: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
});

/** `useColorScheme` returns null on some Android emulator images; dark is the safer guess. */
export function useSystemDark(): boolean {
  return useColorScheme() !== 'light';
}
