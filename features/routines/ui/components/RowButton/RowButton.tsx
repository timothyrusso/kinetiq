import { Pressable } from 'react-native';
import { ICON_SIZE, Icon, type IconName, useStyles } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import type { Theme } from '@/features/core/theme';
import { createStyles } from '@/features/routines/ui/components/RowButton/RowButton.style';

/**
 * A quiet trailing control: a 44 pt target and an inline glyph, no disc. A row with two filled
 * circles reads as a toolbar, not as one row with controls. Disabled keeps the glyph and loses
 * the press, so the row's shape never shifts at the ends of the list.
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
  const styles = useStyles(createStyles);
  const color = disabled ? theme.colors.textFaint : tone === 'danger' ? theme.colors.danger : theme.colors.textMuted;
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
      style={({ pressed }) => [styles.button, disabled ? styles.disabled : pressed ? styles.pressed : null]}
    >
      <Icon name={icon} size={ICON_SIZE.inline} color={color} />
    </Pressable>
  );
}
