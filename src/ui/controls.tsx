/**
 * The one control still drawn here: the on/off switch the settings screens use until they move
 * onto the platform's own list, where the switch is the list's native one.
 */
import { memo } from 'react';
import { Switch as RNSwitch } from 'react-native';

import { haptics } from '@/services/haptics';
import { palette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme';

export const Toggle = memo(function Toggle({
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <RNSwitch
      value={value}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onValueChange={(next) => {
        haptics.selection();
        onChange(next);
      }}
      trackColor={{ false: theme.colors.placeholder, true: theme.colors.accent }}
      thumbColor={value ? theme.colors.onAccent : palette.white}
      // iOS ignores `trackColor` for the unfilled track and paints a default grey
      // that fights the palette, so it is set explicitly rather than left to the OS.
      ios_backgroundColor={theme.colors.placeholder}
    />
  );
});
