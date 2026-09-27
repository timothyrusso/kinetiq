import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';
import { createStyles } from '@/features/bootstrap/ui/components/RootErrorBoundary/RootErrorBoundary.style';
import { themeFor } from '@/features/core/theme';
import { tr } from '@/features/core/translations';

/**
 * Forced dark rather than system-aware: resolving the system scheme needs the very native bridge
 * that may have failed, and dark is the app's launch theme.
 */
const styles = createStyles(themeFor('dark'));

const openDeviceSettings = () => {
  void Linking.openSettings().catch(() => undefined);
};

type State = { error: Error | null };

/**
 * Catches what the router's per-route boundary cannot: an error thrown while rendering the
 * providers above the navigator. React's answer to an unbounded error is to unmount the whole
 * tree, a blank app with no message. It owns its palette and uses `tr` rather than `useT`: it
 * renders outside the themed tree, a class has no hooks, and the failure may be the theme or the
 * settings store itself; nobody changes language on a terminal screen.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // NOTE: console only. Nothing below this boundary is guaranteed to work, and a throw inside
    // `componentDidCatch` is the blank screen this exists to avoid, with a worse message.
    // biome-ignore lint/suspicious/noConsole: the one report of an error above the navigator
    console.error('[kinetiq] Unhandled error above the navigator', error, info.componentStack);
  }

  /**
   * Clears the boundary, which remounts the provider tree from scratch: that fixes the transient
   * case (a native module that answered too early) and lands back here on the deterministic one.
   */
  private readonly retry = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.badge}>{tr('boot.stopped')}</Text>
        <Text style={styles.title}>{tr('boot.couldNotStartCorrectly')}</Text>
        <Text style={styles.body}>{tr('misc.fatalBody')}</Text>
        <View style={styles.messageBox}>
          <Text style={styles.message} selectable>
            {error.message || tr('errors.unexpected')}
          </Text>
        </View>
        <View style={styles.actions}>
          <Text accessibilityRole="button" onPress={this.retry} style={styles.retry}>
            {tr('boot.tryAgain')}
          </Text>
          <Text accessibilityRole="button" onPress={openDeviceSettings} style={styles.settings}>
            {tr('boot.openDeviceSettings')}
          </Text>
        </View>
      </View>
    );
  }
}
