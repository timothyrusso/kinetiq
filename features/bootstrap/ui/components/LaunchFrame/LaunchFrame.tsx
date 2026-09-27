import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '@/features/bootstrap/ui/components/LaunchFrame/LaunchFrame.style';
import { themeFor } from '@/features/core/theme';

/** Built once per mode from `themeFor`, the only source for the launch colour. */
const STYLES = { dark: createStyles(themeFor('dark')), light: createStyles(themeFor('light')) };

/**
 * The launch screen's frame, matching the native splash exactly: `themeFor` is the one source of
 * the launch colour, so `app.json`, this frame and the first screen cannot disagree.
 */
export function LaunchFrame({ dark, children }: { dark: boolean; children?: ReactNode }) {
  const styles = STYLES[dark ? 'dark' : 'light'];
  return (
    <View style={styles.frame}>
      <View style={styles.mark}>
        <View style={styles.dot} />
        <LaunchText dark={dark} size="brand">
          KINETIQ
        </LaunchText>
      </View>
      {children}
    </View>
  );
}

/** Plain system text: fonts are what may still be loading, or may have failed outright. */
export function LaunchText({
  children,
  dark,
  size = 'body',
  muted,
  mono,
}: {
  children: string;
  dark: boolean;
  size?: 'brand' | 'title' | 'body';
  muted?: boolean;
  mono?: boolean;
}) {
  const styles = STYLES[dark ? 'dark' : 'light'];
  return (
    <Text
      style={[
        styles.text,
        size === 'title' ? styles.title : null,
        size === 'brand' ? styles.brand : null,
        muted ? styles.muted : null,
        mono ? styles.mono : null,
      ]}
    >
      {children}
    </Text>
  );
}
