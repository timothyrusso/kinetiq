import { View } from 'react-native';
import { useStyles } from '@/features/core/design-system';
import { useSessionProgressBarLogic } from '@/features/workouts/ui/components/SessionProgressBar/SessionProgressBar.logic';
import { createStyles } from '@/features/workouts/ui/components/SessionProgressBar/SessionProgressBar.style';

/** Sets done over sets planned: the progress the bar under the player's header reports. */
export function SessionProgressBar({ ratio }: { ratio: number }) {
  const { derived } = useSessionProgressBarLogic(ratio);
  const styles = useStyles(createStyles);
  return (
    <View style={styles.track}>
      <View style={[styles.fill, derived.fillWidth]} />
    </View>
  );
}
