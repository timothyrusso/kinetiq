import { Pressable, StyleSheet } from 'react-native';
import { ICON_SIZE, Icon, type IconName } from '@/features/core/design-system/icons/icons';
import { haptics } from '@/features/core/haptics';
import { type Theme, touchTarget } from '@/features/core/theme';

const styles = StyleSheet.create({
  button: { width: touchTarget * 0.8, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.45 },
  disabled: { opacity: 0.4 },
});

/**
 * A quiet trailing control: a 44 pt target and an inline glyph, no disc. A row with two filled
 * circles reads as a toolbar, not as one row with controls. Disabled keeps the glyph and loses
 * the press, so the row's shape never shifts at the ends of the list. It reads no context: rows
 * pass the theme, so a list of them is not a list of context consumers.
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
