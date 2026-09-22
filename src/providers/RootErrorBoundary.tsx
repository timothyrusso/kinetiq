/**
 * Catches what the router's per-route boundary cannot: an error thrown while rendering
 * the *providers*: the query client, the safe-area provider, the gesture root.
 *
 * Those sit above the navigator, so no route boundary is above them, and React's rule for
 * an unbounded error is to unmount the whole tree: a blank app with no message.
 *
 * ## Why this component owns its own theme
 *
 * It renders outside `ThemedRoot`, so it has no access to `useAppTheme()`: and even if it
 * did, the failure may *be* the theme or the settings store it reads through. So it takes
 * a plain colour pair and renders plain `Text`. An error screen that depends on the system
 * that broke is not an error screen.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { themeFor } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { tr } from '@/i18n/tr';

type State = { error: Error | null };

export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only. There is no upload here on purpose: nothing below this boundary is
    // guaranteed to work, and a throw inside `componentDidCatch` is an unrecoverable
    // error in React: the blank screen we are trying to avoid, with a worse message.
    console.error('[kinetiq] Unhandled error above the navigator', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Forced dark rather than system-aware: resolving the system scheme needs
    // `useColorScheme()`, i.e. the very native bridge that may have failed. Dark is the
    // safer default because the app's launch background is dark in that theme.
    const theme = themeFor('dark');

    // `tr` rather than `useT` here, and it is the one place that is correct.
    //
    // This is a class component, so there is no hook to call, and the screen it renders is
    // terminal: the app has already failed above the navigator. Nobody changes language on
    // this screen, so the subscription `useT` buys has nothing to do. Everywhere else the
    // rule is the opposite, and `npm run check` enforces it.

    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.badge, { color: theme.colors.danger }]}>{tr('boot.stopped')}</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {tr('boot.couldNotStartCorrectly')}
        </Text>
        <Text style={[styles.body, { color: theme.colors.textMuted }]}>
          {tr('misc.fatalBody')}
        </Text>
        <View
          style={[
            styles.messageBox,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.message, { color: theme.colors.text }]} selectable>
            {error.message || 'Unknown error'}
          </Text>
        </View>
        <View style={styles.actions}>
          <Text
            accessibilityRole="button"
            onPress={() => {
              // Clears the boundary's state, which re-renders `children`: i.e. remounts
              // the provider tree from scratch. That fixes the transient case (a native
              // module that answered too early) and re-throws the deterministic one,
              // landing back here. There is no programmatic restart available without
              // `expo-updates`, and adding a dependency to render a "Reload" button is not
              // a trade worth making.
              this.setState({ error: null });
            }}
            style={[styles.action, { color: theme.colors.accent }]}
          >
            {tr('boot.tryAgain')}
          </Text>
          <Text
            accessibilityRole="button"
            onPress={() => {
              Linking.openSettings().catch(() => undefined);
            }}
            style={[styles.action, { color: theme.colors.textMuted }]}
          >
            {tr('boot.openDeviceSettings')}
          </Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
  badge: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22 },
  messageBox: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  message: { fontSize: 13.5, lineHeight: 20, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  action: { fontSize: 15, fontWeight: '600', paddingVertical: spacing.sm },
});
