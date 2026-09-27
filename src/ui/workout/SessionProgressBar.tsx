import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { Theme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { withAlpha } from '@/utils/color';

/** Sets done over sets planned: the progress the bar under the player's header reports. */
export function SessionProgressBar({ ratio, theme }: { ratio: number; theme: Theme }) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: withAlpha(theme.colors.text, 0.1) }]}>
      <View
        style={{
          height: '100%',
          width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`,
          backgroundColor: theme.colors.accent,
          borderRadius: radius.pill,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
} satisfies Record<string, ViewStyle>);
