/**
 * Selection controls. Three deliberate choices:
 *
 * - The segmented control animates a measured thumb instead of using the native
 *   one, because the native version cannot carry brand colour on iOS and does not
 *   exist on Android. It is still exposed as a group of buttons with `selected`
 *   state, so a screen reader gets the same semantics either way.
 * - `Toggle` wraps RN's native switch rather than drawing one. A custom switch is
 *   a week of accessibility work to arrive at what the platform already does.
 * - `Stepper`'s long-press repeat clears its timer on *every* exit path, including
 *   unmount. A leaked interval here would tick after a workout screen unmounts and
 *   write numbers into a state object nobody is reading.
 */
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  Switch as RNSwitch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { palette, radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme';
import { haptics } from '@/services/haptics';
import { withAlpha } from '@/utils/color';
import { AnimatedPressable, settleSpring, usePressScale } from './animation';
import { Icon, type IconName } from './icons';
import { Txt } from './Text';

export type Segment<T extends string> = { value: T; label: string; icon?: IconName };

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  style,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [rowHeight, setRowHeight] = useState(0);

  const selectedIndex = Math.max(
    0,
    segments.findIndex((s) => s.value === value),
  );
  // Measured rather than assumed: this control is used inside cards whose padding
  // varies, and a thumb sized from a guess lands a pixel off on wide phones.
  const innerWidth = trackWidth > 0 ? trackWidth - INSET * 2 : 0;
  const segmentWidth = segments.length > 0 ? innerWidth / segments.length : 0;
  const targetX = segmentWidth * selectedIndex;

  // The spring starts in an effect and the style function only reads the cell.
  // Writing `translateX.value` from render — which is what this did first, on the
  // theory that an effect would leave the thumb trailing the label colour — trips
  // Reanimated's render-write warning on every mount of every screen that carries
  // the control, and bought nothing: this effect runs in the same commit as the
  // `onLayout` that first gives the thumb a width, so the earliest visible frame is
  // still the thumb sitting under the selected label rather than sliding into place.
  // `settleSpring` carries `reduceMotion: System`, so the old hand-written
  // `useReducedMotion` branch here was doing the same job twice, less correctly.
  const translateX = useSharedValue(targetX);
  const seeded = useRef(false);
  useEffect(() => {
    // The first real target arrives with `onLayout`, when the thumb stops being
    // zero-wide. Snapping there instead of springing is what keeps a freshly
    // mounted control from animating its own entrance: before this, a control
    // defaulting to the third segment would slide its thumb in from the left.
    if (segmentWidth > 0 && !seeded.current) {
      seeded.current = true;
      translateX.value = targetX;
      return;
    }
    translateX.value = withSpring(targetX, settleSpring);
  }, [targetX, segmentWidth, translateX]);

  const thumbStyle = useAnimatedStyle(
    () => ({
      width: segmentWidth,
      height: rowHeight > 0 ? rowHeight - INSET * 2 : 0,
      transform: [{ translateX: translateX.value }],
    }),
    [segmentWidth, rowHeight],
  );

  return (
    <View
      onLayout={(e) => {
        setTrackWidth(e.nativeEvent.layout.width);
        setRowHeight(e.nativeEvent.layout.height);
      }}
      style={[
        {
          flexDirection: 'row',
          padding: INSET,
          borderRadius: radius.pill,
          backgroundColor: theme.colors.placeholder,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: INSET,
            top: INSET,
            borderRadius: radius.pill,
            backgroundColor: theme.colors.accent,
          },
          thumbStyle,
        ]}
      />
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(segment.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: MIN_SEGMENT_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.xs,
            }}
          >
            {segment.icon ? (
              <Icon
                name={segment.icon}
                size={15}
                color={selected ? theme.colors.onAccent : theme.colors.textMuted}
              />
            ) : null}
            <Txt
              variant="caption"
              weight="bold"
              color={selected ? theme.colors.onAccent : theme.colors.textMuted}
              numberOfLines={1}
            >
              {segment.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const INSET = 3;
const MIN_SEGMENT_HEIGHT = 34;

/**
 * A pill filter token. Used in horizontally scrolling filter rails; for stacked,
 * described options use `FilterOption`.
 */
export const Chip = memo(function Chip({
  label,
  selected = false,
  onPress,
  icon,
  count,
  size = 'md',
  onRemove,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  count?: number;
  size?: 'sm' | 'md';
  /** Turns the chip into a removable filter token with an inline ✕. */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const scale = usePressScale(0.96);
  const fg = selected ? theme.colors.onAccent : theme.colors.text;
  const height = size === 'sm' ? 30 : 38;

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count} results`}
      accessibilityState={{ selected }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          borderRadius: radius.pill,
          backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
          borderWidth: 1,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
        },
        scale.style,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} color={fg} /> : null}
      <Txt variant={size === 'sm' ? 'caption' : 'label'} weight="bold" color={fg} numberOfLines={1}>
        {label}
      </Txt>
      {count === undefined ? null : (
        <Txt variant="caption" weight="semibold" color={fg}>
          {count}
        </Txt>
      )}
      {onRemove ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onRemove();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label} filter`}
          style={{ marginLeft: 2, opacity: 0.7 }}
        >
          <Icon name="close" size={13} color={fg} />
        </Pressable>
      ) : null}
    </AnimatedPressable>
  );
});

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

/**
 * Numeric stepper for reps/weight/rest. Long-press repeats, and the value is
 * quantised to the step's own precision so 2.5 + 2.5 + 2.5 reads as 7.5 rather than
 * 7.500000000000001 — the difference between a clean log and one that needs
 * formatting everywhere it is displayed.
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
  style,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  /** What is being adjusted, for the accessibility label of each button. */
  label: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const held = useRef(false);

  // Long-press repeat needs the *latest* value on every tick, so the tick reads a ref
  // rather than closing over `value` — the classic stale-closure bug in steppers is a
  // repeat that keeps adding to the number that was under the finger when it started.
  const valueRef = useRef(value);
  valueRef.current = value;

  const clamp = useCallback(
    (n: number) => {
      const stepped = Math.round(n / step) * step;
      const decimals = step < 1 ? 2 : 0;
      return Math.min(max, Math.max(min, Number(stepped.toFixed(decimals))));
    },
    [max, min, step],
  );

  const commit = useCallback(
    (delta: number) => {
      const next = clamp(valueRef.current + delta);
      if (next === valueRef.current) return;
      valueRef.current = next;
      haptics.selection();
      onChange(next);
    },
    [clamp, onChange],
  );

  const stop = useCallback(() => {
    held.current = false;
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(
    (delta: number) => {
      commit(delta);
      held.current = true;
      stop();
      timer.current = setInterval(() => {
        if (held.current) commit(delta);
      }, 110);
    },
    [commit, stop],
  );

  // Unmount while held — navigating away mid-press, a parent re-key — must not leave
  // an interval writing to a component that no longer exists.
  useEffect(() => stop, [stop]);

  const edge = (delta: number) => (delta > 0 ? value >= max : value <= min);

  const button = (delta: number, icon: IconName) => (
    <Pressable
      onPressIn={() => start(delta)}
      onPressOut={stop}
      // `increment`/`decrement` are RN *action* types, not roles — the role union has
      // no equivalent, so these announce as plainly-labelled buttons, which is what a
      // screen reader user can actually operate here.
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Increase' : 'Decrease'} ${label}, currently ${formatStepperValue(value)}${suffix ? ` ${suffix}` : ''}`}
      hitSlop={8}
      style={{
        width: compact ? 30 : MIN_SEGMENT_HEIGHT,
        height: compact ? 30 : MIN_SEGMENT_HEIGHT,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceRaised,
        opacity: edge(delta) ? 0.4 : 1,
      }}
    >
      <Icon name={icon} size={compact ? 13 : 16} color={theme.colors.text} />
    </Pressable>
  );

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {button(-step, 'minus')}
      <View
        // Android re-announces the number as the long-press repeat runs it up.
        accessibilityLiveRegion="polite"
        style={{ alignItems: 'center', minWidth: compact ? 46 : 60 }}
      >
        <Txt variant={compact ? 'numeralSm' : 'numeral'}>
          {formatStepperValue(value)}
          {suffix ? <Txt variant="caption" tone="faint">{` ${suffix}`}</Txt> : null}
        </Txt>
      </View>
      {button(step, 'plus')}
    </View>
  );
});

function formatStepperValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * A labelled row that toggles a boolean filter. Distinct from `Chip`: this one owns
 * its label and a description, and is used in the filter sheet where the tap target
 * has to carry the explanation with it.
 */
export const FilterOption = memo(function FilterOption({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? withAlpha(theme.colors.accent, 0.45) : 'transparent',
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.xs,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: selected ? 0 : 1.5,
          borderColor: theme.colors.borderStrong,
          backgroundColor: selected ? theme.colors.accent : 'transparent',
        }}
      >
        {selected ? (
          <Icon name="check" size={14} color={theme.colors.onAccent} strokeWidth={3} />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Txt variant="body" weight="semibold">
          {label}
        </Txt>
        {description ? (
          <Txt variant="caption" tone="muted">
            {description}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
});

/**
 * Segmented pill used for the two-choice cases where a full `SegmentedControl`
 * would be too heavy — "Repeat / History" in a sheet header, for instance.
 */
export const TogglePill = memo(function TogglePill({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  accessibilityLabel: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: selected ? theme.colors.accent : 'transparent',
              borderRightWidth: i === options.length - 1 ? 0 : 1,
              borderColor: theme.colors.border,
            }}
          >
            <Txt
              variant="caption"
              weight="bold"
              color={selected ? theme.colors.onAccent : theme.colors.textMuted}
            >
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
});
