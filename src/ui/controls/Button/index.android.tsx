/**
 * The app's button. Primary and secondary are Material 3's own filled and outlined buttons in
 * the app's accent; ghost, quiet, danger and any loading button are the drawn button.
 */
import { memo } from 'react';
import { Button as FilledButton, Host, OutlinedButton, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { DrawnButton, FILL_STYLE, HUG_STYLE } from './Drawn';
import type { ButtonProps } from './types';

export type { ButtonProps, ButtonSize, ButtonVariant } from './types';

export const Button = memo(function Button(props: ButtonProps) {
  const theme = useAppTheme();
  const { variant = 'primary', loading = false } = props;
  if (loading || (variant !== 'primary' && variant !== 'secondary')) return <DrawnButton {...props} />;
  const { label, onPress, disabled = false, fullWidth = false, weighty = false, style } = props;
  const press = () => {
    if (weighty) haptics.heavy();
    else haptics.medium();
    onPress();
  };
  const modifiers = fullWidth ? [fillMaxWidth()] : [];
  return (
    <Host
      matchContents={fullWidth ? { vertical: true } : true}
      colorScheme={theme.mode}
      seedColor={theme.colors.accent}
      style={[fullWidth ? FILL_STYLE : HUG_STYLE, style]}
    >
      {variant === 'primary' ? (
        <FilledButton
          onClick={press}
          enabled={!disabled}
          modifiers={modifiers}
          colors={{ containerColor: theme.colors.accent, contentColor: theme.colors.onAccent }}
        >
          <Text>{label}</Text>
        </FilledButton>
      ) : (
        <OutlinedButton onClick={press} enabled={!disabled} modifiers={modifiers}>
          <Text>{label}</Text>
        </OutlinedButton>
      )}
    </Host>
  );
});
