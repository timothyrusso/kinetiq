import { Host, Switch as NativeSwitch } from '@expo/ui';
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { haptics } from '@/features/core/haptics';
import { useAppTheme } from '@/features/core/theme';

type SwitchProps = {
  /** The row's label, read with the switch as one control. */
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

/**
 * A labelled on/off row outside a settings list: the platform's own switch through Expo UI's
 * universal `Switch`, a SwiftUI `Toggle` on iOS and a Material 3 `Switch` beside its label on
 * Android. The host hugs the row's height, which Dynamic Type can change, and fills the width.
 */
export const Switch = memo(function Switch({ label, value, onChange, disabled = false }: SwitchProps) {
  const theme = useAppTheme();
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={theme.mode}
      seedColor={theme.colors.accent}
      style={styles.host}
    >
      <NativeSwitch
        label={label}
        value={value}
        disabled={disabled}
        onValueChange={next => {
          haptics.selection();
          onChange(next);
        }}
      />
    </Host>
  );
});

const styles = StyleSheet.create({ host: { width: '100%' } });
