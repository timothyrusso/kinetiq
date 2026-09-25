import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Host, Stepper as NativeStepper } from '@expo/ui/swift-ui';
import { labelsHidden } from '@expo/ui/swift-ui/modifiers';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { StepperValue } from './StepperValue';
import { stepClamp, type StepperProps } from './types';

export type { StepperProps } from './types';

/**
 * UIKit's stepper, with the value it controls beside it.
 *
 * The system control is the pair of − and + buttons with the platform's own hold-to-repeat; it
 * draws no number, so the value sits to its left as the thing being read, the way Settings
 * lays out a stepper row. Tapping the value types it: see `StepperValue`.
 */
export const Stepper = memo(function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  label,
  compact = false,
  decimal = false,
}: StepperProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View accessibilityLiveRegion="polite" style={styles.value}>
        <StepperValue
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          suffix={suffix}
          label={label}
          compact={compact}
          decimal={decimal || !Number.isInteger(step)}
          align="left"
        />
      </View>
      <Host matchContents colorScheme={theme.mode} seedColor={theme.colors.accent}>
        <NativeStepper
          label={label}
          value={value}
          step={step}
          min={min}
          max={max}
          modifiers={[labelsHidden()]}
          onValueChange={(next) => {
            const clamped = stepClamp(next, { min, max, step });
            if (clamped === value) return;
            haptics.selection();
            onChange(clamped);
          }}
        />
      </Host>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: { minWidth: 60 },
});
