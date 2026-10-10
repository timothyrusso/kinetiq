import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStepperPress } from '@/features/core/design-system/controls/Stepper/Stepper.logic';
import { StepperValue } from '@/features/core/design-system/controls/Stepper/StepperValue';
import { useStepperField } from '@/features/core/design-system/controls/Stepper/StepperValue.logic';
import { formatStepperValue, type StepperProps } from '@/features/core/design-system/controls/Stepper/types';
import { ICON_SIZE, Icon, type IconName } from '@/features/core/design-system/icons/icons';
import { radius, spacing, touchTarget, useAppTheme } from '@/features/core/theme';

export type { StepperProps } from '@/features/core/design-system/controls/Stepper/types';

/**
 * Material has no stepper, so this is the Material idiom for one: two outlined icon buttons
 * with the value centred between them, and hold-to-repeat (see `useStepperPress`). Tapping the
 * value types it: see `StepperValue`.
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
  format,
}: StepperProps) {
  const theme = useAppTheme();
  const typesDecimals = decimal || !Number.isInteger(step);
  const field = useStepperField(value, onChange, { min, max, decimal: typesDecimals }, format);
  const { effects } = useStepperPress(field.state.value, field.effects.write, { min, max, step }, field.effects.take);

  const size = compact ? 32 : touchTarget - spacing.xs;
  const button = (delta: number, icon: IconName) => {
    const atEdge = delta > 0 ? field.state.value >= max : field.state.value <= min;
    return (
      <Pressable
        onPressIn={() => effects.press(delta)}
        onPressOut={effects.release}
        disabled={atEdge}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${delta > 0 ? '+' : '-'}${formatStepperValue(Math.abs(delta))}`}
        android_ripple={{ color: theme.colors.surfacePressed, borderless: true }}
        hitSlop={spacing.sm}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderColor: theme.colors.border,
            opacity: atEdge ? 0.38 : 1,
          },
        ]}
      >
        <Icon name={icon} size={compact ? ICON_SIZE.micro : ICON_SIZE.inline} color={theme.colors.text} />
      </Pressable>
    );
  };

  return (
    <View style={styles.row}>
      {button(-step, 'minus')}
      <View accessibilityLiveRegion="polite" style={[styles.value, { minWidth: compact ? 46 : 60 }]}>
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
          align="center"
        />
      </View>
      {button(step, 'plus')}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  value: { alignItems: 'center' },
  button: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
