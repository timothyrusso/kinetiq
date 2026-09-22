/**
 * An icon that is itself the control: remove a set, skip, pause. A 44 pt target whatever the
 * glyph's size, with haptics owned by the control. Content icons are Ionicons, like every
 * other icon drawn in React Native.
 */
import { memo, useCallback } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { radius, touchTarget } from '@/theme/tokens';
import { AnimatedPressable, usePressScale } from '@/ui/animation';
import { Icon, type IconName } from '@/ui/icons';

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

type IconButtonProps = {
  name: IconName;
  onPress: (e: GestureResponderEvent) => void;
  /** Required: an icon-only control has nothing else to be read as. */
  accessibilityLabel: string;
  variant?: 'plain' | 'surface' | 'accent' | 'danger';
  size?: number;
  disabled?: boolean;
  /** Fires `heavy`: for destructive or committing actions. */
  weighty?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export const IconButton = memo(function IconButton({
  name,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  size = 22,
  disabled = false,
  weighty = false,
  style,
  accessibilityHint,
}: IconButtonProps) {
  const theme = useAppTheme();
  const scale = usePressScale(0.9);
  const fg =
    variant === 'danger'
      ? theme.colors.danger
      : variant === 'accent'
        ? theme.colors.onAccent
        : theme.colors.text;

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled) return;
      if (weighty) haptics.heavy();
      else haptics.light();
      onPress(e);
    },
    [disabled, onPress, weighty],
  );

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={scale.onPressIn}
      onPressOut={scale.onPressOut}
      disabled={disabled}
      hitSlop={HIT}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      {...(accessibilityHint ? { accessibilityHint } : null)}
      style={[
        {
          width: touchTarget,
          height: touchTarget,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            variant === 'surface'
              ? theme.colors.surfaceRaised
              : variant === 'accent'
                ? theme.colors.accent
                : variant === 'danger'
                  ? theme.colors.dangerSoft
                  : 'transparent',
        },
        scale.style,
        style,
      ]}
    >
      <Icon name={name} size={size} color={fg} />
    </AnimatedPressable>
  );
});
