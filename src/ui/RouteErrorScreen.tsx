/**
 * Route-level error screen.
 *
 * Used by expo-router's per-route `ErrorBoundary` export and by the root class
 * boundary. Both exist because React's rule is that an error with no boundary above it
 * unmounts the entire tree — a blank app with no message, which is the single worst
 * failure a user can be left with.
 *
 * ## Deliberately not `Txt`
 *
 * The themed primitives reach for `useAppTheme()`, which reads the settings store, which
 * reads a database. If the failure *is* the store or the theme, a themed error screen
 * throws while reporting the throw — and a boundary's boundary is a crash, not an error
 * screen. So this file takes its colours as a parameter and renders plain `Text`.
 *
 * The `theme` prop rather than a hook for the same reason: the caller decides how
 * confident it is that the theme is resolvable (the router boundary knows the app
 * mounted fine; the root boundary does not, and passes a fixed dark theme).
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';

export function RouteErrorScreen({
  error,
  theme,
  onRetry,
  onGoHome,
}: {
  error: Error;
  theme: Theme;
  onRetry: () => void;
  onGoHome?: () => void;
}) {
  // Stack kept in full: the first frame is usually inside a library, and the line the
  // user needs is the third or fourth. Truncated to a length that survives a support
  // screenshot.
  const stack = (error.stack ?? error.message).split('\n').slice(0, 8).join('\n');

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.scroll}
        // The error text is selectable because the job of this screen is to get the
        // message out of the app and into a bug report.
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.badge, { backgroundColor: theme.colors.dangerSoft }]}>
          <Text style={[styles.badgeText, { color: theme.colors.danger }]}>SOMETHING BROKE</Text>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          This screen hit an error
        </Text>
        <Text style={[styles.body, { color: theme.colors.textMuted }]}>
          Your workouts, routines and settings were not affected. You can try the screen
          again, or go back and carry on elsewhere in the app.
        </Text>

        <View style={[styles.messageBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.message, { color: theme.colors.text }]} selectable>
            {error.message || 'Unknown error'}
          </Text>
        </View>

        <Text
          style={[styles.stack, { color: theme.colors.textFaint }]}
          selectable
          numberOfLines={8}
        >
          {stack}
        </Text>

        <View style={styles.actions}>
          <Button label="Try again" variant="primary" onPress={onRetry} />
          {onGoHome ? (
            <Button label="Go to Home" variant="secondary" onPress={onGoHome} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md, paddingTop: spacing.huge },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22 },
  messageBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  message: { fontSize: 14, lineHeight: 20, fontFamily: 'monospace' },
  stack: { fontSize: 11.5, lineHeight: 17, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
});
