import { View } from 'react-native';
import { ButtonPair, useStyles } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { createStyles } from '@/features/home/ui/components/StartChoice/StartChoice.style';

/**
 * The two ways to start: a workout with no routine behind it, or a new routine. Equal halves of
 * one row, the same height even when one label wraps, in the same order as the header menu.
 * Starting is off while a session runs, since there is one session at a time; a new routine is
 * always allowed.
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
      <ButtonPair
        left={{ label: t('workoutTab.startEmpty'), icon: 'play', disabled: startDisabled, onPress: onStartEmpty }}
        right={{ label: t('workout.newRoutine'), icon: 'plus', onPress: onNewRoutine }}
      />
    </View>
  );
}
