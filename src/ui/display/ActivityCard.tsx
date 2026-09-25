/**
 * One workout: kind tone, headline stat and a `MetaLine`.
 *
 * List discipline, like `rows.tsx`: `theme` and units arrive as props, and `onPress` takes the
 * id, so a list passes one stable callback to every card instead of building a closure per row.
 */
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Activity } from '@/domain/types';
import type { Theme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { IconTile } from '@/ui/icons';
import { CellText } from '@/ui/CellText';
import { ACTIVITY_ICON } from '@/ui/rows';
import type { UnitSystem } from '@/utils/format';
import { activitySummary } from './activityMeta';
import { MetaLine } from './MetaLine';

export const ActivityCard = memo(function ActivityCard({
  activity,
  theme,
  units,
  onPress,
  onLongPress,
}: {
  activity: Activity;
  theme: Theme;
  units: UnitSystem;
  onPress: (id: string) => void;
  /** Same id-taking shape as `onPress`, so a list can pass one stable callback for both. */
  onLongPress?: (id: string) => void;
}) {
  const summary = useMemo(
    () => activitySummary(activity, units),
    [activity, units],
  );
  const press = useCallback(() => onPress(activity.id), [onPress, activity.id]);
  const longPress = useCallback(() => onLongPress?.(activity.id), [onLongPress, activity.id]);
  const skin = theme.surfaceSkin;

  return (
    <Pressable
      onPress={press}
      {...(onLongPress ? { onLongPress: longPress } : {})}
      accessibilityRole="button"
      accessibilityLabel={summary.accessibilityLabel}
      android_ripple={skin.rowPressed === 'ripple' ? { color: theme.colors.surfacePressed } : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors[skin.surface], borderRadius: skin.radius },
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
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, minWidth: 0, gap: spacing.xs },
});
