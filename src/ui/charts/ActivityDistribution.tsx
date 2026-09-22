/**
 * Activity distribution: where the week's training actually went.
 *
 * A donut is only honest with few slices and a shared denominator, so this component owns
 * both constraints: it collapses anything past the four largest kinds into "Other" and it
 * refuses to draw at all when the total is zero. Five-slice donuts on a phone are the
 * reason people distrust donut charts.
 *
 * Segment colours come from `theme.colors.tone`, the same map the row icons use, so a run
 * is the same green in the legend, in the list, and in the ring. That consistency is the
 * only thing that makes a donut readable without hunting for the key.
 */
import { memo, useEffect, useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { fontFamily, spacing } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import type { ActivityKind } from '@/domain/types';
import { ACTIVITY_ICON } from '../rows';
import { Icon } from '../icons';
import { arcPath, sweepTo } from './geometry';
import { tr } from '@/i18n/tr';
import { useT } from '@/i18n/useT';

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Kinds drawn individually; anything beyond this is summed into "Other". */
const MAX_SLICES = 4;
const GAP_RAD = 0.045;

export type DistributionSlice = {
  kind: ActivityKind;
  /** Minutes, volume, sessions: whatever the caller is counting. Only ratios are used. */
  value: number;
};

export const ActivityDistribution = memo(function ActivityDistribution({
  slices,
  theme,
  size = 132,
  strokeWidth = 16,
  formatValue,
  centerLabel,
  centerSublabel,
  showLegend = true,
  animate = true,
  emptyLabel,
  style,
}: {
  slices: DistributionSlice[];
  theme: Theme;
  size?: number;
  strokeWidth?: number;
  /** Turns a raw value into legend text ("48 min", "12 sets"). */
  formatValue: (value: number) => string;
  centerLabel?: string;
  centerSublabel?: string;
  showLegend?: boolean;
  animate?: boolean;
  emptyLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useT();
  const reduced = useReducedMotion();

  // Zero and negative values are dropped here rather than trusted from the caller: one
  // zero-value slice in the data would otherwise render a round dot at the 12 o'clock
  // angle, which reads as a full circle at that colour.
  const { drawn, total } = useMemo(() => {
    const positive = slices.filter((s) => Number.isFinite(s.value) && s.value > 0);
    const sorted = [...positive].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, MAX_SLICES);
    const rest = sorted.slice(MAX_SLICES);
    const sum = positive.reduce((acc, s) => acc + s.value, 0);
    const list: Array<{ kind: ActivityKind | 'other'; value: number; share: number }> = top.map(
      (s) => ({ kind: s.kind, value: s.value, share: s.value / sum }),
    );
    if (rest.length > 0) {
      const other = rest.reduce((acc, s) => acc + s.value, 0);
      list.push({ kind: 'other', value: other, share: other / sum });
    }
    return { drawn: list, total: sum };
  }, [slices]);

  const progress = useSharedValue(animate && !reduced ? 0 : 1);
  useEffect(() => {
    progress.value =
      animate && !reduced
        ? withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) })
        : 1;
  }, [animate, progress, reduced]);

  const revealStyle = useAnimatedStyle(() => ({ opacity: 0.2 + 0.8 * progress.value }), [progress]);


  if (drawn.length === 0 || total <= 0) {
    return (
      <View
        style={[
          { minHeight: 96, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
          style,
        ]}
      >
        <Text
          style={{
            fontFamily: fontFamily.medium,
            fontSize: 13,
            color: theme.colors.textFaint,
            textAlign: 'center',
          }}
        >
          {emptyLabel ?? t('distribution.empty')}
        </Text>
      </View>
    );
  }

  const thickness = Math.max(6, strokeWidth);
  const ringRadius = (size - thickness) / 2;
  const centre = size / 2;
  const single = drawn.length === 1;
  const singleD = single
    ? arcPath(centre, centre, ringRadius, sweepTo(0), sweepTo(0.9999))
    : '';
  const circumference = 2 * Math.PI * ringRadius * 0.9999;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }, style]}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} aria-hidden focusable={false}>
          {single
            ? null
            : drawn.map((slice, i) => (
                <Segment
                  key={`${slice.kind}-${i}`}
                  index={i}
                  share={slice.share}
                  offset={drawn.slice(0, i).reduce((acc, s) => acc + s.share, 0)}
                  centre={centre}
                  radius={ringRadius}
                  thickness={thickness}
                  color={colorFor(slice.kind, theme)}
                  progress={progress}
                />
              ))}
          {single ? (
            // A single kind is a complete ring, so there is no arc to sweep open: the reveal
            // is the whole group fading in, exactly as `ProgressRing` reveals one-ring weeks.
            <Path
              d={singleD}
              stroke={colorFor(drawn[0]?.kind ?? 'run', theme)}
              strokeWidth={thickness}
              strokeLinecap="round"
              fill="none"
              // 2πr · 0.9999 matches the hair-under-full arc `sweepTo` produces everywhere
              // else, and the dash is measured by hand because `pathLength` is SVG2: which
              // react-native-svg does not implement.
              strokeDasharray={`${circumference}`}
              strokeDashoffset={0}
            />
          ) : null}
        </Svg>
        <Animated.View style={[revealStyle, { alignItems: 'center', position: 'absolute' }]}>
          {centerLabel ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fontFamily.displayMedium,
                fontSize: size * 0.2,
                color: theme.colors.text,
              }}
            >
              {centerLabel}
            </Text>
          ) : null}
          {centerSublabel ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fontFamily.medium,
                fontSize: Math.max(9, size * 0.095),
                color: theme.colors.textFaint,
                marginTop: 1,
              }}
            >
              {centerSublabel}
            </Text>
          ) : null}
        </Animated.View>
      </View>

      {showLegend ? (
        // A donut that cannot be read without its legend should not show a donut. The
        // list is the accessible presentation of the same numbers, so VoiceOver gets the
        // data rather than "pie chart, 5 slices".
        <View
          accessibilityRole="summary"
          accessibilityLabel={t('distribution.a11y', {
            breakdown: drawn
              .map((d) => `${labelFor(d.kind)} ${Math.round(d.share * 100)}%`)
              .join(', '),
          })}
          style={{ flex: 1, gap: spacing.sm }}
        >
          {drawn.map((slice, i) => (
            <View key={`${slice.kind}-legend-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon
                name={slice.kind === 'other' ? 'layers' : ACTIVITY_ICON[slice.kind]}
                size={14}
                color={colorFor(slice.kind, theme)}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: fontFamily.medium,
                  fontSize: 13,
                  color: theme.colors.textMuted,
                }}
              >
                {labelFor(slice.kind)}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily.semibold,
                  fontSize: 13,
                  color: theme.colors.text,
                }}
              >
                {formatValue(slice.value)}
              </Text>
              <Text
                style={{
                  width: 34,
                  textAlign: 'right',
                  fontFamily: fontFamily.medium,
                  fontSize: 12,
                  color: theme.colors.textFaint,
                }}
              >
                {Math.round(slice.share * 100)}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const Segment = memo(function Segment({
  index,
  share,
  offset,
  centre,
  radius: r,
  thickness,
  color,
  progress,
}: {
  index: number;
  share: number;
  offset: number;
  centre: number;
  radius: number;
  thickness: number;
  color: string;
  progress: { value: number };
}) {
  const props = useAnimatedProps(
    () => {
      const clamp = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
      const r2 = (v: number): number => Math.round(v * 100) / 100;
      const sweep = (t: number): number => -Math.PI / 2 + Math.min(clamp(t), 0.9999) * Math.PI * 2;

      // The gap is subtracted in *angle* space, which is what `GAP_RAD` is denominated in.
      // `offset` and `share` are turns, so the arithmetic that used to live up here mixed the
      // two: half a `GAP_RAD` added to a turn-count charged every slice ~8° per edge instead
      // of the ~1.3° intended, and a four-kind week lost a sixth of the ring to gaps that were
      // never in the design.
      const fromAngle = sweep(offset) + GAP_RAD / 2;
      const toAngle = sweep(offset + share) - GAP_RAD / 2;
      // A slice too small to hold the gap would end before it began and render a backwards
      // arc, so it collapses to nothing instead.
      if (toAngle <= fromAngle) return { d: '' };

      // The whole ring sweeps together (all segments share one progress) rather than each
      // growing on its own: independently animating arcs make adjacent slices overlap
      // mid-flight, which looks like a rendering glitch.
      const liveTo = fromAngle + (toAngle - fromAngle) * clamp(progress.value);
      const sx = centre + r * Math.cos(fromAngle);
      const sy = centre + r * Math.sin(fromAngle);
      const ex = centre + r * Math.cos(liveTo);
      const ey = centre + r * Math.sin(liveTo);
      const large = Math.abs(liveTo - fromAngle) > Math.PI ? 1 : 0;
      return {
        d: `M${r2(sx)} ${r2(sy)} A${r2(r)} ${r2(r)} 0 ${large} 1 ${r2(ex)} ${r2(ey)}`,
      };
    },
    [centre, offset, progress, r, share],
  );

  return (
    <AnimatedPath
      animatedProps={props}
      stroke={color}
      strokeWidth={thickness}
      // Round caps on a segmented ring make tiny slices balloon past their neighbours and
      // change the apparent ratio, so segments are butt-capped. The single-slice case in
      // the parent uses a round cap because there is nothing to overlap.
      strokeLinecap="butt"
      fill="none"
      key={`seg-${index}`}
    />
  );
});

function colorFor(kind: ActivityKind | 'other', theme: Theme): string {
  return kind === 'other' ? theme.colors.textFaint : theme.colors.tone[kind];
}

/**
 * Slice names, from the catalog.
 *
 * A `switch` returning English words is invisible to both copy scanners: it has no JSX text
 * and no `label=` prop, which is how this one survived a pass that reported every screen
 * translated. `tr` rather than a `t` parameter because the legend renders inside a memoised
 * component that takes its data, not its wording, from the caller.
 */
function labelFor(kind: ActivityKind | 'other'): string {
  switch (kind) {
    case 'run':
      return tr('distribution.running');
    case 'ride':
      return tr('distribution.cycling');
    case 'lift':
      return tr('distribution.strength');
    case 'walk':
      return tr('distribution.walking');
    case 'yoga':
      return tr('distribution.yoga');
    case 'other':
      return tr('distribution.other');
  }
}

export type ActivityDistributionProps = React.ComponentProps<typeof ActivityDistribution>;
