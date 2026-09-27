import { memo } from 'react';
import { View } from 'react-native';
import { useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { UnitSystem } from '@/features/core/utils';
import { createStyles } from '@/features/home/ui/components/WorkoutCell/WorkoutCell.style';
import type { Activity } from '@/features/workouts';
import { ActivityCard } from '@/features/workouts/pages';

/**
 * One workout card with the gutter and the gap below, so the card fills the width it is given
 * and the list builds no style object per row. `onPress` and `onLongPress` take the id, so every
 * row gets the same two callbacks.
 */
export const WorkoutCell = memo(function WorkoutCell({
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
  onLongPress: (id: string) => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.cell}>
      <ActivityCard activity={activity} theme={theme} units={units} onPress={onPress} onLongPress={onLongPress} />
    </View>
  );
});
