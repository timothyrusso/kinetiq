import { Host, Stepper as NativeStepper } from '@expo/ui/swift-ui';
import { labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { StepperValue } from '@/features/core/design-system/controls/Stepper/StepperValue';
import { useStepperField } from '@/features/core/design-system/controls/Stepper/StepperValue.logic';
import { type StepperProps, stepClamp } from '@/features/core/design-system/controls/Stepper/types';
import { haptics } from '@/features/core/haptics';
import { spacing, useAppTheme } from '@/features/core/theme';

export type { StepperProps } from '@/features/core/design-system/controls/Stepper/types';

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
  const typesDecimals = decimal || !Number.isInteger(step);
  const field = useStepperField(value, onChange, { min, max, decimal: typesDecimals });
  return (
    <View style={styles.row}>
      <View accessibilityLiveRegion="polite" style={styles.value}>
        <StepperValue
          text={field.state.text}
          input={field.state.input}
          selectOnFocus={field.state.selectOnFocus}
          onFocus={field.effects.focus}
          onChangeText={field.effects.changeText}
          onBlur={field.effects.blur}
          suffix={suffix}
          label={label}
          compact={compact}
          decimal={typesDecimals}
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
          onValueChange={next => {
            const from = field.effects.flush() ?? value;
            const clamped = stepClamp(from + next - value, { min, max, step });
            if (clamped === from) return;
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
