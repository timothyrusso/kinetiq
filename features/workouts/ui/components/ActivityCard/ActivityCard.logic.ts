import { useCallback, useMemo } from 'react';
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import { useStyles } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import type { Theme } from '@/features/core/theme';
import type { UnitSystem } from '@/features/core/utils';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import { activityDisplay } from '@/features/workouts/mappers/activityDisplay';
import { createStyles } from '@/features/workouts/ui/components/ActivityCard/ActivityCard.style';

/**
 * The card's summary, built once per workout and units, and its presses, each handing back the
 * workout's id. A tap is the lightest acknowledgment; the long press gets `warning`, because what
 * it opens is a delete confirm.
 */
export function useActivityCardLogic(
  activity: Activity,
  units: UnitSystem,
  theme: Theme,
  onPress: (id: string) => void,
  onLongPress: ((id: string) => void) | undefined,
) {
  const styles = useStyles(createStyles);
  const summary = useMemo(() => activityDisplay(activity, units), [activity, units]);
  const press = useCallback(() => {
    haptics.light();
    onPress(activity.id);
  }, [onPress, activity.id]);
  const longPress = useCallback(() => {
    haptics.warning();
    onLongPress?.(activity.id);
  }, [onLongPress, activity.id]);
  const highlight = theme.surfaceSkin.rowPressed === 'highlight';
  const cardStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.card,
      pressed && highlight ? styles.pressed : null,
    ],
    [highlight, styles],
  );
  const ripple = useMemo(
    () => (theme.surfaceSkin.rowPressed === 'ripple' ? { color: theme.colors.surfacePressed } : undefined),
    [theme],
  );
  return {
    derived: { summary, cardStyle, ripple, hasLongPress: onLongPress !== undefined },
    effects: { press, longPress },
  };
}
