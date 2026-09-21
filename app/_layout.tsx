/**
 * Root layout: providers above the router, chrome below.
 *
 * ## What mounts where, and why that order is load-bearing
 *
 * `AppProviders` sits *outside* `Stack`, not inside it. Bootstrap has to gate the
 * navigator itself, not just its first screen: a `Stack` that mounts while the database
 * is still opening creates scenes, and scenes run their queries. Putting the gate below
 * the navigator would mean the gate's own error screen is rendered by a navigator that
 * may already have thrown.
 *
 * `GestureRoot` and `SafeAreaProvider` wrap the navigator too, for the mirror reason: a
 * sheet inside a stack needs both, and either one mounting *below* the navigator means the
 * first screen in the tree is precisely the one that lacks them.
 *
 * ## Theme propagation
 *
 * Kinetiq's theme comes from `useAppTheme()`; React Navigation's comes from
 * `ThemeProvider`. One source, two consumers: `NAV_*_THEME` are module constants derived
 * from `themeFor`, so React Navigation's theme context is compared by identity and does
 * not re-theme every navigator on every render.
 *
 * ## Error boundaries
 *
 * Two, at different heights. expo-router wraps every route element in its own boundary and
 * uses this file's `ErrorBoundary` export for anything thrown here; `RootErrorBoundary`
 * sits above even that, because a throw inside the providers has no route boundary above
 * it, and React's response to that is to unmount the whole app.
 */
import { Appearance } from 'react-native';
import { router, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NAV_DARK_THEME, NAV_LIGHT_THEME } from '@/navigation/theme';
import { AppProviders } from '@/providers/AppProviders';
import { GestureRoot } from '@/providers/bootstrap';
import { RootErrorBoundary } from '@/providers/RootErrorBoundary';
import { statusBarStyle, themeFor, useAppTheme } from '@/theme/theme';
import { RouteErrorScreen } from '@/ui/RouteErrorScreen';

export default function RootLayout() {
  return (
    <AppProviders>
      {/* Above `ThemedRoot` on purpose: if a provider itself throws, the themed tree is
          exactly what cannot be trusted to render the report. */}
      <RootErrorBoundary>
        <ThemedRoot />
      </RootErrorBoundary>
    </AppProviders>
  );
}

/**
 * Split out because `useAppTheme()` needs the providers above it, while those providers
 * have to wrap the component that calls it. Without the split, one component would be both
 * the provider and its own consumer, which React does not allow.
 */
function ThemedRoot() {
  const theme = useAppTheme();
  return (
    <SafeAreaProvider>
      <GestureRoot canvasColor={theme.colors.background}>
        <ThemeProvider value={theme.mode === 'dark' ? NAV_DARK_THEME : NAV_LIGHT_THEME}>
          {/*
            Set here rather than per-screen. `expo-status-bar` merges multiple mounted
            `<StatusBar>`s in mount order, so a screen-level bar and a root-level bar that
            disagree resolve to whichever mounted last: during a transition that is a coin
            flip. Screens with a genuinely opposite need (a full-bleed photo header) can
            still mount their own and win while focused.
          */}
          <StatusBar style={statusBarStyle(theme.mode)} animated />
          <Stack
            screenOptions={{
              headerShown: false,
              // Transparent, so the canvas colour comes from one place (`GestureRoot`)
              // rather than every navigator repainting it mid-push.
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen name="(tabs)" />
            {/* `workout` is a card, not a sheet: it hosts nested push screens (session →
                exercise picker → history), which a `modal` presentation would trap: a
                sheet cannot push, and the usual workaround (a nested stack inside the
                sheet) buys a grabber bar and costs back-gesture reliability. The
                bottom-sheet *feel* comes from the rounded top corners, the slide-from-below
                transition and the scrim, none of which need `presentation`. */}
            <Stack.Screen name="workout" />
            {/* Full-cover sheets: each hosts one self-contained flow with no nesting. */}
            <Stack.Screen name="routine" />
            <Stack.Screen name="exercise" />
            <Stack.Screen name="activity" />
            <Stack.Screen name="progress" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="permissions" />
            <Stack.Screen name="dev" />
            <Stack.Screen
              name="+not-found"
              options={{
                // A card, so the OS back gesture can undo a bad link. Presented as a
                // full-screen modal, a deep link to a mistyped route would be inescapable
                // except through the button we render.
                presentation: 'card',
              }}
            />
          </Stack>
        </ThemeProvider>
      </GestureRoot>
    </SafeAreaProvider>
  );
}

/**
 * Route-level error boundary: expo-router calls this for anything thrown while rendering
 * a route, including this layout.
 *
 * What it must not do is what expo-router's built-in default does: render a red box in
 * development and a blank screen in production. This one keeps the app's chrome, names the
 * failure, and offers the two actions that actually help: retry, or go Home.
 *
 * `themeFor(systemIsDark())` rather than `useAppTheme()` because if the throw came *from*
 * the settings store, a boundary reading that store would throw while reporting the throw.
 * Falling back to the system scheme costs exactly one thing: a user who forced light mode
 * inside a dark-system OS sees a dark error screen: and buys immunity to the failure being
 * reported.
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
 * The system appearance, read without a hook.
 *
 * `useColorScheme()` is the right tool inside the app and the wrong one here: it returns
 * `null` until the native value arrives, so a boundary using it renders one theme and then
 * flips: the exact flash the launch background exists to prevent. `Appearance` is the
 * synchronous native read; the two agree in steady state, and this path only runs once
 * something has already gone wrong.
 */
function systemIsDark(): boolean {
  try {
    return Appearance.getColorScheme() === 'dark';
  } catch {
    // The native module is the thing that would be missing. Dark is the safe default: it
    // is the app's launch theme, and light-on-dark stays legible for more people in an
    // emergency than the reverse.
    return true;
  }
}
