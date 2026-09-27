import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ACTIVITY_ICON, CellText, IconTile, MetaLine, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { UnitSystem } from '@/features/core/utils';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import { useActivityCardLogic } from '@/features/workouts/ui/components/ActivityCard/ActivityCard.logic';
import { createStyles } from '@/features/workouts/ui/components/ActivityCard/ActivityCard.style';

/**
 * One recorded workout: the kind's tile, the title over its facts, and the headline number. List
 * discipline: the theme and the units are props and the presses take the id, so a list passes
 * one stable callback to every card.
 */
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
  const { derived, effects } = useActivityCardLogic(activity, units, theme, onPress, onLongPress);
  const styles = useStyles(createStyles);

  return (
    <Pressable
      onPress={effects.press}
      {...(derived.hasLongPress ? { onLongPress: effects.longPress } : {})}
      accessibilityRole="button"
      accessibilityLabel={derived.summary.accessibilityLabel}
      android_ripple={derived.ripple}
      style={derived.cardStyle}
    >
      <View style={styles.head}>
        <IconTile
          name={ACTIVITY_ICON[activity.kind]}
          color={theme.colors.accent}
          background={theme.colors.accentSoft}
        />
        <View style={styles.titles}>
          <CellText text={activity.title} variant="subhead" weight="600" color={theme.colors.text} numberOfLines={1} />
          <MetaLine items={derived.summary.meta} theme={theme} wrap />
        </View>
        <CellText text={derived.summary.headline} variant="numeralSm" color={theme.colors.text} align="right" />
      </View>
    </Pressable>
  );
});
