import { router } from 'expo-router';
import { useCallback } from 'react';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { formatDuration } from '@/features/core/utils';
import { isInProgress } from '@/features/workouts/domain/utils/sessionStatus';
import { useActiveSession } from '@/features/workouts/facades/useActiveSession';

/** The pill's label and detail for the workout in progress, or nothing when there is none. */
export function useWorkoutAccessoryLogic() {
  const { t } = useT();
  const { session } = useActiveSession();
  const open = useCallback(() => router.push(routes.workoutSession()), []);
  const live = isInProgress(session) ? session : null;
  return {
    derived: {
      label: live?.routineName ?? null,
      detail:
        live === null ? '' : live.status === 'paused' ? t('workout.paused') : formatDuration(live.elapsedSeconds, ':'),
    },
    effects: { open },
  };
}
