import { useCallback } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { usePulse, useStyles } from '@/features/core/design-system';
import { createStyles } from '@/features/workouts/ui/components/ActiveWorkoutPill/ActiveWorkoutPill.style';

/** The pill's spoken label, its pressed look and the breathing of its dot. */
export function useActiveWorkoutPillLogic(label: string, detail: string | undefined) {
  const styles = useStyles(createStyles);
  const pillStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [styles.pill, pressed ? styles.pressed : null],
    [styles],
  );
  const pulse = usePulse(1600, 0.35);
  return { derived: { accessibilityLabel: detail ? `${label}, ${detail}` : label, pillStyle, pulse } };
}
