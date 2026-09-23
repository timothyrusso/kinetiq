/**
 * The button drawn in React Native: every variant the platforms' native buttons do not have
 * (ghost, quiet, danger), and any button while it is loading, which needs a spinner in place
 * of its label at the same width.
 *
 * Three things it gets right that a styled Touchable gets wrong. Haptics are part of the
 * control, and the user's setting is honoured once, in the service. The press animation is a
 * shared value on the UI thread, so a press never re-renders the subtree. A disabled button
 * still announces itself, and a loading one keeps its idle width so a form does not jump.
 */
import { memo, useCallback } from 'react';
import { ActivityIndicator, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/services/haptics';
import { useAppTheme, type Theme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';
import { AnimatedPressable, usePressScale } from '@/ui/animation';
import { Icon } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import type { ButtonProps, ButtonSize, ButtonVariant } from './types';

/** RN's `Insets` is edges-only, so the four edges are spelled out once here. */
const HIT = { top: 8, bottom: 8, left: 8, right: 8 };


export const DrawnButton = memo(function DrawnButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  weighty = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useAppTheme();
  const skin = buttonSkin(theme, variant, size);
  const scale = usePressScale(variant === 'primary' ? 0.975 : 0.99);
  const inactive = disabled || loading;

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (inactive) return;
      if (weighty) haptics.heavy();
      else haptics.medium();
      onPress(e);
    },
    [inactive, onPress, weighty],
  );

  const content = (
    <View style={skin.row} pointerEvents="none">
      {loading ? (
        <ActivityIndicator size="small" color={skin.fg} />
      ) : icon ? (
        <Icon name={icon} size={skin.iconSize} color={skin.fg} />
      ) : null}
      <Txt
        variant={size === 'lg' ? 'bodyLg' : 'strong'}
        weight="bold"
        color={skin.fg}
        // Truncating a button label is worse than a wide button: the action is the
        // whole message. Callers keep labels short; this only guards extreme cases.
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {label}
      </Txt>
      {trailingIcon ? <Icon name={trailingIcon} size={skin.iconSize} color={skin.fg} /> : null}
    </View>
  );

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={scale.onPressIn}
      onPressOut={scale.onPressOut}
      disabled={disabled}
      hitSlop={HIT}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      {...(accessibilityHint ? { accessibilityHint } : null)}
      style={[
        fullWidth ? FILL_STYLE : null,
        {
          minHeight: skin.height,
          paddingHorizontal: skin.padX,
          borderRadius: skin.radius,
          backgroundColor: skin.bg,
          borderWidth: skin.border,
          borderColor: skin.borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.42 : 1,
        },
        theme.shadows[variant === 'primary' ? 'accent' : 'none'],
        scale.style,
        style,
      ]}
    >
      {content}
    </AnimatedPressable>
  );
});

type Skin = {
  bg: string;
  fg: string;
  border: number;
  borderColor: string;
  height: number;
  padX: number;
  radius: number;
  iconSize: number;
  row: StyleProp<ViewStyle>;
};

/**
 * `quiet` is the fourth real variant people expect from a fitness app: the de-emphasised
 * "not now" beside a primary CTA. It is not `ghost`: ghost is for toolbars and has a
 * shorter height and no minimum width.
 */
function buttonSkin(theme: Theme, variant: ButtonVariant, size: ButtonSize): Skin {
  const height = size === 'lg' ? 54 : size === 'md' ? 48 : 38;
  const padX = size === 'lg' ? spacing.xxl : size === 'md' ? spacing.xl : spacing.lg;
  const iconSize = size === 'sm' ? 16 : 18;
  const base = { height, padX, iconSize, radius: size === 'sm' ? radius.sm : radius.pill };

  const row = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: size === 'sm' ? spacing.xs : spacing.sm,
  };

  switch (variant) {
    case 'primary':
      return {
        ...base,
        bg: theme.colors.accent,
        fg: theme.colors.onAccent,
        border: 0,
        borderColor: 'transparent',
        row,
      };
    case 'secondary':
      return {
        ...base,
        bg: theme.colors.surfaceRaised,
        fg: theme.colors.text,
        border: 1,
        borderColor: theme.colors.border,
        row,
      };
    case 'ghost':
      return {
        ...base,
        bg: 'transparent',
        fg: theme.colors.accent,
        border: 0,
        borderColor: 'transparent',
        row,
      };
    case 'quiet':
      return {
        ...base,
        bg: theme.colors.placeholder,
        fg: theme.colors.textMuted,
        border: 0,
        borderColor: 'transparent',
        row,
      };
    case 'danger':
      return {
        ...base,
        bg: theme.colors.danger,
        fg: theme.colors.onDanger,
        border: 0,
        borderColor: 'transparent',
        row,
      };
  }
}

/**
 * How a full-width button takes the width, on every platform. A width rather than
 * `alignSelf: 'stretch'`: inside a row, stretch grows the cross axis, which is the height, and a
 * native button became a tall sliver with no room for its label. `flexShrink` lets it share a
 * row with a sibling.
 */
export const FILL_STYLE = { width: '100%', flexShrink: 1 } as const;
