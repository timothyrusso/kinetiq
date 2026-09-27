import { Effect, Layer } from 'effect';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { type AppStateStatus, AppState as NativeAppState } from 'react-native';
import type { AppState } from '@/features/bootstrap/domain/entities/AppState';
import { LaunchEnvironment } from '@/features/bootstrap/domain/services/LaunchEnvironment';
import { toAppError } from '@/features/core/error';
import { getNetworkStatus, startNetworkStatus, subscribeNetworkStatus } from '@/features/core/network';
import { getQueryClient, installQueryAdapters } from '@/features/core/query';
import { themeFor } from '@/features/core/theme';
import { invalidateCatalogQueries } from '@/features/exercises';

/**
 * `unknown` and `extension` are real statuses the launch has no opinion about. Both mean "not the
 * foreground, do not bank time", which is what `background` does, so collapsing them is behaviour.
 */
const appStateOf = (status: AppStateStatus): AppState =>
  status === 'active' || status === 'inactive' ? status : 'background';

/** The network probe's first answer: an optimistic `online` before it would send a request into a dead radio. */
const firstNetworkAnswer = Effect.async<boolean>(resume => {
  if (getNetworkStatus().known) {
    resume(Effect.succeed(getNetworkStatus().online));
    return;
  }
  const unsubscribe = subscribeNetworkStatus(() => {
    if (!getNetworkStatus().known) return;
    unsubscribe();
    resume(Effect.succeed(getNetworkStatus().online));
  });
  return Effect.sync(unsubscribe);
});

/** The one app-state subscription, and the listener it calls: a launch run again replaces it. */
let appStateListener: ((next: AppState) => void) | null = null;

/**
 * The launch environment over the core singletons and the native modules. The query plumbing's
 * disposers are dropped on purpose: they are process-lifetime singletons. The Android
 * navigation buttons are left alone: since Android 10 the system keeps the gesture pill legible
 * against the window background the root colour sets.
 */
export const LaunchEnvironmentLive = Layer.succeed(LaunchEnvironment, {
  installQueryPlumbing: Effect.sync(() => {
    startNetworkStatus();
    installQueryAdapters();
  }),
  // NOTE: the fonts and the header icons are loaded on first use, so importing the runtime (as the
  // jest tests do) never loads expo-font or the native glyph renderer.
  loadFonts: Effect.tryPromise({
    try: () => import('@/features/bootstrap/libraries/appFonts').then(fonts => fonts.loadAppFonts()),
    catch: cause => toAppError(cause),
  }),
  prefetchHeaderIcons: Effect.tryPromise({
    try: () => import('@/features/core/navigation').then(navigation => navigation.prefetchHeaderIcons()),
    catch: cause => toAppError(cause),
  }),
  paintChrome: mode =>
    Effect.sync(() => {
      // NOTE: bootstrap best effort, allow-listed: the chrome is cosmetic and `paintChrome` never
      // fails (see `LaunchEnvironment`), so a refused colour or a status bar that throws below
      // leaves the default chrome, the same as on a device without the native call.
      void SystemUI.setBackgroundColorAsync(themeFor(mode).brandBackground).catch(() => undefined);
      StatusBar.setStyle(mode === 'dark' ? 'light' : 'dark', true);
    }).pipe(Effect.catchAllDefect(() => Effect.void)),
  online: firstNetworkAnswer,
  catalogChanged: Effect.promise(() => invalidateCatalogQueries(getQueryClient())),
  appState: Effect.sync(() => appStateOf(NativeAppState.currentState)),
  onAppStateChange: listener =>
    Effect.sync(() => {
      if (appStateListener === null) {
        NativeAppState.addEventListener('change', status => appStateListener?.(appStateOf(status)));
      }
      appStateListener = listener;
    }),
});
