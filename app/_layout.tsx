import { QueryClientProvider } from '@tanstack/react-query';
import { EffectRuntimeProvider } from '@timothyrusso/effect-core/react';
import { type ErrorBoundaryProps, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders, GestureRoot, RootErrorBoundary } from '@/features/bootstrap/pages';
import { RouteErrorScreen } from '@/features/core/design-system';
import {
  formSheet,
  NAV_DARK_THEME,
  NAV_LIGHT_THEME,
  useHeaderOptions,
  useTabsScreenOptions,
} from '@/features/core/navigation';
import { getQueryClient } from '@/features/core/query';
import { runtime } from '@/features/core/runtime';
import { statusBarStyle, themeFor, useAppTheme } from '@/features/core/theme';
import { WatchInboxNotice } from '@/features/watch-sync/pages';

/**
 * Root layout: providers above the router, chrome below. The query client and the one Effect
 * runtime are outermost, so the launch runs through the same boundary as every query. The launch
 * gate (`AppProviders`) sits outside `Stack`: a navigator that mounted while the database was still
 * opening would create scenes, and scenes run their queries. `RootErrorBoundary` sits above the
 * themed tree, because a throw inside the providers has no route boundary above it and the themed
 * tree is exactly what cannot be trusted to render the report.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <EffectRuntimeProvider runtime={runtime}>
        <AppProviders>
          <RootErrorBoundary>
            <ThemedRoot />
          </RootErrorBoundary>
          <WatchInboxNotice />
        </AppProviders>
      </EffectRuntimeProvider>
    </QueryClientProvider>
  );
}

/**
 * The themed chrome and the one stack, split out because `useAppTheme()` needs the providers above
 * it. React Navigation's theme is a module constant per mode, compared by identity, so it does not
 * re-theme every navigator on every render. The status bar is set here, not per screen: two
 * mounted bars that disagree resolve to whichever mounted last, a coin flip mid-transition.
 *
 * The tabs draw no header of their own at this level: each tab is a stack with its own native
 * header. Every pushed route lives in this one stack rather than a nested stack per folder, so the
 * system back button, its history menu and the Android back gesture all work unaided. The player
 * keeps `gestureEnabled: false`: a swipe must not discard an unfinished workout. Editors are routes
 * presented as the platform's sheet; the exercise item editor is not `fit`, because with the
 * picture and description under the targets a fit-to-contents sheet clips instead of scrolling.
 * The unmatched route is a card, so the OS back gesture can undo a bad link.
 */
function ThemedRoot() {
  const theme = useAppTheme();
  const headerOptions = useHeaderOptions();
  const tabsOptions = useTabsScreenOptions();
  return (
    <SafeAreaProvider>
      <GestureRoot>
        <ThemeProvider value={theme.mode === 'dark' ? NAV_DARK_THEME : NAV_LIGHT_THEME}>
          <StatusBar style={statusBarStyle(theme.mode)} animated />
          <Stack screenOptions={headerOptions}>
            <Stack.Screen name="(tabs)" options={tabsOptions} />
            <Stack.Screen name="workout/session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="routine/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="pick-exercise" options={formSheet('picker')} />
            <Stack.Screen name="edit-profile" options={formSheet('fit')} />
            <Stack.Screen name="routine/item" options={formSheet('picker')} />
            <Stack.Screen name="routine/rename" options={formSheet('fit')} />
            <Stack.Screen name="workout/set" options={formSheet('fit')} />
            <Stack.Screen name="workout/records" options={{ ...formSheet('fit'), gestureEnabled: false }} />
            <Stack.Screen name="+not-found" options={{ presentation: 'card' }} />
          </Stack>
        </ThemeProvider>
      </GestureRoot>
    </SafeAreaProvider>
  );
}

/**
 * Route-level error boundary: expo-router calls it for anything thrown while rendering a route,
 * this layout included. It keeps the app's chrome, names the failure and offers retry or Home. It
 * reads the system scheme, not `useAppTheme()`: if the throw came from the settings store, a
 * boundary reading that store would throw while reporting it.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <RouteErrorScreen
      error={error}
      theme={themeFor(systemIsDark() ? 'dark' : 'light')}
      onRetry={() => {
        void retry();
      }}
      onGoHome={() => {
        router.replace('/');
      }}
    />
  );
}

/**
 * The system appearance, read without a hook: `useColorScheme()` returns `null` until the native
 * value arrives, and a boundary using it would flash. When the native module is the thing that is
 * missing, dark is the safe default: it is the app's launch theme.
 */
function systemIsDark(): boolean {
  try {
    return Appearance.getColorScheme() === 'dark';
  } catch {
    // NOTE: the native module missing is the failure this boundary may be showing; dark is the answer.
    return true;
  }
}
