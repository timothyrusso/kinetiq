/**
 * A pill filter token in the Human Interface style: SwiftUI has no chip, so this is the HIG
 * capsule drawn in React Native. Used in horizontally scrolling filter rails.
 */
import { memo } from 'react';
import { Pressable } from 'react-native';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';
import { AnimatedPressable, usePressScale } from '@/ui/animation';
import { Icon } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import type { ChipProps } from './types';

export type { ChipProps } from './types';

export const Chip = memo(function Chip({
  label,
  selected = false,
  onPress,
  icon,
  count,
  size = 'md',
  onRemove,
  style,
}: ChipProps) {
  const theme = useAppTheme();
  const scale = usePressScale(0.96);
  const fg = selected ? theme.colors.onAccent : theme.colors.text;
  const height = size === 'sm' ? 30 : 38;

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count} results`}
      accessibilityState={{ selected }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          borderRadius: radius.pill,
          backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
          borderWidth: 1,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
        },
        scale.style,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} color={fg} /> : null}
      <Txt variant={size === 'sm' ? 'caption' : 'label'} weight="bold" color={fg} numberOfLines={1}>
        {label}
      </Txt>
      {count === undefined ? null : (
        <Txt variant="caption" weight="semibold" color={fg}>
          {count}
        </Txt>
      )}
      {onRemove ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onRemove();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label} filter`}
          style={{ marginLeft: spacing.xxs, opacity: 0.7 }}
        >
          <Icon name="close" size={13} color={fg} />
        </Pressable>
      ) : null}
    </AnimatedPressable>
  );
});

