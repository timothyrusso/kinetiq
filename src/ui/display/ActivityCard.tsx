/**
 * One activity: kind tone, headline stat, a `MetaLine`, and an optional thumbnail.
 *
 * List discipline, like `rows.tsx`: `theme` and units arrive as props, and `onPress` takes the
 * id, so a list passes one stable callback to every card instead of building a closure per row.
 *
 * `compact` drops the surface and the thumbnail and reads as a list row; the full card is for
 * places that show a handful of activities, where a route trace is worth its draw cost.
 */
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Activity } from '@/domain/types';
import type { Theme } from '@/theme/theme';
import { screenGutter, spacing } from '@/theme/tokens';
import { RouteTrace } from '@/ui/charts/RouteTrace';
import { IconTile } from '@/ui/icons';
import { CellText } from '@/ui/CellText';
import { ACTIVITY_ICON } from '@/ui/rows';
import type { UnitSystem } from '@/utils/format';
import { activitySummary } from './activityMeta';
import { MetaLine } from './MetaLine';

const THUMB_HEIGHT = 96;
const CHART_BARS = 8;

export const ActivityCard = memo(function ActivityCard({
  activity,
  theme,
  units,
  showSpeedInsteadOfPace = false,
  thumbnail = 'none',
  compact = false,
  onPress,
  onLongPress,
}: {
  activity: Activity;
  theme: Theme;
  units: UnitSystem;
  showSpeedInsteadOfPace?: boolean;
  thumbnail?: 'map' | 'chart' | 'none';
  compact?: boolean;
  onPress: (id: string) => void;
  /** Same id-taking shape as `onPress`, so a list can pass one stable callback for both. */
  onLongPress?: (id: string) => void;
}) {
  const summary = useMemo(
    () => activitySummary(activity, units, showSpeedInsteadOfPace),
    [activity, units, showSpeedInsteadOfPace],
  );
  const press = useCallback(() => onPress(activity.id), [onPress, activity.id]);
  const longPress = useCallback(() => onLongPress?.(activity.id), [onLongPress, activity.id]);
  const skin = theme.surfaceSkin;
  const route = activity.cardio?.route ?? [];
  const showMap = !compact && thumbnail === 'map' && route.length > 1;
  const showChart = !compact && thumbnail === 'chart' && (activity.strength?.entries.length ?? 0) > 0;

  return (
    <Pressable
      onPress={press}
      {...(onLongPress ? { onLongPress: longPress } : {})}
      accessibilityRole="button"
      accessibilityLabel={summary.accessibilityLabel}
      android_ripple={skin.rowPressed === 'ripple' ? { color: theme.colors.surfacePressed } : undefined}
      style={({ pressed }) => [
        compact
          ? styles.compact
          : [styles.card, { backgroundColor: theme.colors[skin.surface], borderRadius: skin.radius }],
        pressed && skin.rowPressed === 'highlight' ? { backgroundColor: theme.colors.surfacePressed } : null,
      ]}
    >
      <View style={styles.head}>
        <IconTile
          name={ACTIVITY_ICON[activity.kind]}
          color={theme.colors.tone[activity.kind]}
          background={theme.colors.toneSoft[activity.kind]}
        />
        <View style={styles.titles}>
          <CellText
            text={activity.title}
            variant="subhead"
            weight="600"
            color={theme.colors.text}
            numberOfLines={1}
          />
          <MetaLine items={summary.meta} theme={theme} wrap />
        </View>
        <CellText text={summary.headline} variant="numeralSm" color={theme.colors.text} align="right" />
      </View>
      {showMap ? (
        <RouteTrace
          route={route}
          kind={activity.kind}
          theme={theme}
          height={THUMB_HEIGHT}
          showLegend={false}
          showStartEnd={false}
          style={styles.thumb}
        />
      ) : null}
      {showChart ? <VolumeBars activity={activity} theme={theme} /> : null}
    </Pressable>
  );
});

/**
 * Per-exercise volume as plain bars. Views, not a canvas: this can sit in a list, and eight
 * rectangles do not need a drawing surface.
 */
function VolumeBars({ activity, theme }: { activity: Activity; theme: Theme }) {
  const bars = useMemo(() => {
    const entries = (activity.strength?.entries ?? []).slice(0, CHART_BARS);
    const volumes = entries.map((e) =>
      e.sets.reduce((sum, s) => sum + (s.completed ? s.reps * s.weightKg : 0), 0),
    );
    const top = Math.max(1, ...volumes);
    return volumes.map((v, i) => ({ key: `${entries[i]?.exerciseId ?? i}:${i}`, ratio: v / top }));
  }, [activity.strength]);
  return (
    <View style={[styles.thumb, styles.bars]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map((b) => (
        <View
          key={b.key}
          style={[
            styles.bar,
            {
              height: Math.max(spacing.xs, Math.round(b.ratio * THUMB_HEIGHT * 0.6)),
              backgroundColor: theme.colors.tone[activity.kind],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md, overflow: 'hidden' },
  compact: { paddingHorizontal: screenGutter, paddingVertical: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, minWidth: 0, gap: spacing.xs },
  thumb: { height: THUMB_HEIGHT },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  bar: { flex: 1, borderRadius: spacing.xs },
});
