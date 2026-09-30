import { useCallback } from 'react';
import { useEffectMutation } from '@/features/core/query';
import type { RestNextUp } from '@/features/notifications/domain/entities/RestNextUp';
import { armRestAlert } from '@/features/notifications/useCases/armRestAlert';
import { cancelNotification } from '@/features/notifications/useCases/cancelNotification';

interface RestAlert {
  readonly exerciseName: string;
  readonly next: RestNextUp;
  readonly delaySeconds: number;
}

/**
 * The alert at the end of a rest: `arm` schedules it and resolves its identifier, `cancel`
 * retracts exactly that one. Fired and forgotten: the rest counts on screen either way, so an
 * alert that could not be scheduled resolves `null` (the boundary has logged why) rather than
 * reaching the screen as an error.
 */
export function useRestAlert() {
  const { mutateAsync: post } = useEffectMutation({
    mutationFn: ({ exerciseName, next, delaySeconds }: RestAlert) => armRestAlert(exerciseName, next, delaySeconds),
  });
  const { mutate: retract } = useEffectMutation({ mutationFn: (identifier: string) => cancelNotification(identifier) });
  const arm = useCallback((alert: RestAlert): Promise<string | null> => post(alert).catch(() => null), [post]);
  const cancel = useCallback((identifier: string) => retract(identifier), [retract]);
  return { arm, cancel };
}
