import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Icon, ICON_SIZE, type IconName } from '@/ui/icons';
import { haptics } from '@/services/haptics';
import type { Theme } from '@/theme/theme';
import { touchTarget } from '@/theme/tokens';

/**
 * A quiet trailing control: a 44pt target, an inline glyph, no disc.
 *
 * `IconButton` draws a filled circle, and a row with two filled circles in it reads as a
 * toolbar rather than as one row with controls. Disabled rows keep the glyph and lose the
 * press, so the shape of the control never shifts when the ends of the list change.
 */
export function RowButton({
  icon,
  label,
  onPress,
  disabled = false,
  tone = 'muted',
  theme,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'muted' | 'danger';
  theme: Theme;
}) {
  const color = disabled
    ? theme.colors.textFaint
    : tone === 'danger'
      ? theme.colors.danger
      : theme.colors.textMuted;
  return (
    <Pressable
      onPress={() => {
        if (tone === 'danger') haptics.light();
        else haptics.selection();
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        styles.rowButton,
        { opacity: pressed && !disabled ? 0.45 : disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={icon} size={ICON_SIZE.inline} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowButton: {
    width: touchTarget * 0.8,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
} satisfies Record<string, ViewStyle>);
