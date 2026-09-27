import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Theme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';
import { useT } from '@/i18n/useT';
import { usePulse } from '@/ui/animation';
import { CellText } from '@/ui/CellText';
import { Icon } from '@/ui/icons';

/**
 * Live-session pill, floating above the bar so it is reachable from every tab without
 * covering what the user is reading. The dot breathes: a static dot says "a session
 * exists", a breathing one says it is happening now: which is the distinction that
 * matters when you come back to the app twenty minutes later.
 */
export const ActiveWorkoutPill = memo(function ActiveWorkoutPill({
  label,
  detail,
  onPress,
  theme,
}: {
  label: string;
  /** Elapsed time or set count: whatever the session wants to advertise. */
  detail?: string;
  onPress: () => void;
  theme: Theme;
}) {
  const { t } = useT();
  const pulse = usePulse(1600, 0.35);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityHint={t('misc.opensWorkoutInProgress')}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm + 2,
          borderRadius: radius.pill,
          backgroundColor: theme.colors.surfaceRaised,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.88 : 1,
          ...theme.shadows.raised,
        },
      ]}
    >
      <Animated.View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: theme.colors.tertiary,
          },
          pulse,
        ]}
      />
      <CellText text={label} variant="label" weight="600" color={theme.colors.text} />
      {detail ? (
        <CellText text={detail} variant="monoSm" color={theme.colors.textMuted} />
      ) : null}
      <Icon name="chevronRight" size={15} color={theme.colors.textFaint} />
    </Pressable>
  );
});
