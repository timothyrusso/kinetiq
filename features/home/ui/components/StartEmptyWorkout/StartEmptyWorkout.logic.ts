import { useCallback } from 'react';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import { useStartSession } from '@/features/workouts';

/**
 * Starts a session with nothing in it yet: exercises are added from inside the player, which
 * offers the picker while its list is empty. The player opens once the session is live.
 */
export function useStartEmptyWorkoutLogic(onStarted: () => void) {
  const { t } = useT();
  const { start } = useStartSession();
  const press = useCallback(() => {
    start({ routineId: null, name: t('workoutTab.emptyWorkoutName'), items: [] }, () => {
      haptics.success();
      onStarted();
    });
  }, [onStarted, start, t]);
  return { effects: { press } };
}
