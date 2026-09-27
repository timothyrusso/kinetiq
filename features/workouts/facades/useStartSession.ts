import { useCallback, useRef } from 'react';
import { useEffectMutation } from '@/features/core/query';
import type { SessionPlan } from '@/features/workouts/domain/schemas/SessionPlanSchema';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import { startSession } from '@/features/workouts/useCases/startSession';

/**
 * Starts a workout from a plan and puts it in the store, which writes it. `start` calls
 * `onStarted` once the session is live, so the caller navigates to a session that exists.
 *
 * The re-entrancy latch is a ref, not `isPending`: two taps in the same frame both see the state
 * the callback closed over, and a second start would fail with `SessionAlreadyActive` at best.
 */
export function useStartSession() {
  const starting = useRef(false);
  const mutation = useEffectMutation({
    mutationFn: (plan: SessionPlan) => startSession(plan, useSessionStore.getState().session),
    onSuccess: session => useSessionStore.getState().start(session, Date.now()),
    onSettled: () => {
      starting.current = false;
    },
  });
  const { mutate } = mutation;
  const start = useCallback(
    (plan: SessionPlan, onStarted?: () => void) => {
      if (starting.current) return;
      starting.current = true;
      mutate(plan, { onSuccess: () => onStarted?.() });
    },
    [mutate],
  );
  return { start, busy: mutation.isPending, error: mutation.error };
}
