import { View } from 'react-native';
import { Button, SectionHeader, useStyles } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useStartEmptyWorkoutLogic } from '@/features/home/ui/components/StartEmptyWorkout/StartEmptyWorkout.logic';
import { createStyles } from '@/features/home/ui/components/StartEmptyWorkout/StartEmptyWorkout.style';

/** Quick start: a workout with no routine behind it. */
export function StartEmptyWorkout({ onStarted }: { onStarted: () => void }) {
  const { effects } = useStartEmptyWorkoutLogic(onStarted);
  const { t } = useT();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.section}>
      <SectionHeader title={t('workoutTab.quickStart')} />
      <Button label={t('workoutTab.startEmpty')} icon="plus" variant="secondary" fullWidth onPress={effects.press} />
    </View>
  );
}
