import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { radius, spacing, touchTarget } from '@/theme/tokens';
import { Icon, ICON_SIZE, type IconName } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import { formatStepperValue, stepClamp, type StepperProps } from './types';

export type { StepperProps } from './types';

/**
 * Material has no stepper, so this is the Material idiom for one: two outlined icon buttons
 * with the value centred between them, and hold-to-repeat.
 *
 * The repeat tick reads the latest value from a ref, not from the closure: the classic stepper
 * bug is a hold that keeps adding to whatever number was under the finger when it started.
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
}: StepperProps) {
  const theme = useAppTheme();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const commit = useCallback(
    (delta: number) => {
      const next = stepClamp(valueRef.current + delta, { min, max, step });
      if (next === valueRef.current) return;
      valueRef.current = next;
      haptics.selection();
      onChange(next);
    },
    [max, min, onChange, step],
  );
  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);
  const start = useCallback(
    (delta: number) => {
      commit(delta);
      stop();
      timer.current = setInterval(() => commit(delta), 110);
    },
    [commit, stop],
  );
  // Unmounted mid-hold (navigating away, a re-key): no interval may outlive the control.
  useEffect(() => stop, [stop]);

  const size = compact ? 32 : touchTarget - spacing.xs;
  const button = (delta: number, icon: IconName) => {
    const atEdge = delta > 0 ? value >= max : value <= min;
    return (
      <Pressable
        onPressIn={() => start(delta)}
        onPressOut={stop}
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
        <Txt variant={compact ? 'numeralSm' : 'numeral'}>
          {formatStepperValue(value)}
          {suffix ? (
            <Txt variant="caption" tone="faint">
              {` ${suffix}`}
            </Txt>
          ) : null}
        </Txt>
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
