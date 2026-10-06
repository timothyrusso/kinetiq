import { View } from 'react-native';
import { Button, useStyles } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { createStyles } from '@/features/home/ui/components/StartChoice/StartChoice.style';

/**
 * The two ways to start: a workout with no routine behind it, or a new routine. Equal halves of
 * one row, in the same order as the header menu. Starting is off while a session runs, since
 * there is one session at a time; a new routine is always allowed.
 */
export function StartChoice({
  startDisabled,
  onStartEmpty,
  onNewRoutine,
}: {
  startDisabled: boolean;
  onStartEmpty: () => void;
  onNewRoutine: () => void;
}) {
  const { t } = useT();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.row}>
      <Button
        label={t('workoutTab.startEmpty')}
        icon="play"
        variant="secondary"
        fullWidth
        disabled={startDisabled}
        onPress={onStartEmpty}
        style={styles.half}
      />
      <Button
        label={t('workout.newRoutine')}
        icon="plus"
        variant="secondary"
        fullWidth
        onPress={onNewRoutine}
        style={styles.half}
      />
    </View>
  );
}
