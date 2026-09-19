/**
 * Buttons. Three things this file gets right that a styled Touchable gets wrong:
 *
 * 1. **Haptics are part of the control, not the screen.** Every primary action
 *    fires one, and the user's "haptics" setting is honoured in exactly one place
 *    (the service), so no screen can accidentally opt back in.
 * 2. **The press animation is derived, not stateful.** `usePressScale` moves a
 *    shared value on the UI thread, so a press never re-renders the subtree — which
 *    matters most on the buttons that sit inside list rows.
 * 3. **A disabled button still announces itself**, and a `loading` button keeps the
 *    same width as its idle self so a form does not jump when it submits.
 */
import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, touchTarget } from '@/theme/tokens';
import { useAppTheme, type Theme } from '@/theme/theme';
import { haptics } from '@/services/haptics';
import { AnimatedPressable, usePressScale } from './animation';
import { Icon, type IconName } from './icons';
import { Txt } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Renders after the label — used for trailing chevrons on list-like buttons. */
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Fires `heavy` instead of `medium` — for committing something weighty. */
  weighty?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * RN's `Insets` is edges-only — the old `{vertical, horizontal}` shorthand is gone —
 * so the four edges are spelled out once here rather than per control.
 */
const HIT = { top: 8, bottom: 8, left: 8, right: 8 };


export const Button = memo(function Button({
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
        {
          alignSelf: fullWidth ? 'stretch' : 'auto',
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

type IconButtonProps = {
  name: IconName;
  onPress: (e: GestureResponderEvent) => void;
  /** Required: an icon-only control has nothing else to be read as. */
  accessibilityLabel: string;
  variant?: 'plain' | 'surface' | 'accent' | 'danger';
  size?: number;
  disabled?: boolean;
  /** Fires `heavy` — for destructive or committing actions. */
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

/**
 * A full-width row that behaves like a button: a list cell, a settings item. Kept
 * separate from `Button` because its anatomy is different (title + supporting text
 * + trailing accessory) and because it must not inherit button skin.
 */
export const ActionRow = memo(function ActionRow({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  tone = 'default',
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  trailing?: React.ReactNode;
  onPress: (e: GestureResponderEvent) => void;
  tone?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const scale = usePressScale(0.995);
  const color = tone === 'danger' ? theme.colors.danger : theme.colors.text;

  return (
    <AnimatedPressable
      onPress={(e: GestureResponderEvent) => {
        haptics.light();
        onPress(e);
      }}
      onPressIn={scale.onPressIn}
      onPressOut={scale.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          minHeight: touchTarget,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: theme.colors.surface,
        },
        scale.style,
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone === 'danger' ? theme.colors.dangerSoft : theme.colors.placeholder,
          }}
        >
          <Icon name={icon} size={18} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyLg" weight="semibold" color={color} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ?? <Icon name="chevronRight" size={18} color={theme.colors.textFaint} />}
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
 * "not now" beside a primary CTA. It is not `ghost` — ghost is for toolbars and has a
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
