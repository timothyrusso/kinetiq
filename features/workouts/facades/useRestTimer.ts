import { useCallback, useEffect, useRef } from 'react';
import { haptics } from '@/features/core/haptics';
import { type TKey, type TVars, useT } from '@/features/core/translations';
import { useRestAlert } from '@/features/notifications';
import { useSettings } from '@/features/settings';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { restRemaining } from '@/features/workouts/domain/utils/workoutMath';
import { sessionActions } from '@/features/workouts/facades/useActiveSession';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

/** Below this a rest cannot be held (the timer floors at five seconds), so it is cleared instead. */
const MIN_REST_SECONDS = 5;

type Translate = (key: TKey, vars?: TVars) => string;

/** The current exercise, clamped: a restored session can point past the end of its list. */
function currentIndex(session: WorkoutSession): number {
  return Math.min(session.activeIndex, Math.max(0, session.entries.length - 1));
}

/** The alert's body: what comes after this set, if anything. */
function nextUpLabel(session: WorkoutSession, activeIndex: number, t: Translate): string {
  const entry = session.entries[activeIndex];
  if (!entry) return '';
  const open = entry.sets.filter(set => !set.completed);
  if (open.length > 1) return t('session.moreSetsOf', { count: open.length - 1, name: entry.exerciseName });
  return session.entries.slice(activeIndex + 1).find(next => next.sets.length > 0)?.exerciseName ?? '';
}

/**
 * The rest between sets: the countdown read from the deadline, its haptics, and the alert that
 * fires at its end while the phone is in a pocket.
 *
 * The alert is armed when a rest starts and retracted only by what ends that rest early: an
 * unticked set, a skip, an adjusted or re-armed rest, a finish or a discard. Leaving the screen
 * mid-rest is exactly what it exists for, so an unmount does not retract it. Every handler is
 * stable and reads the session at call time, because the screen re-renders every second.
 */
export function useRestTimer(session: WorkoutSession | null) {
  const { t } = useT();
  const { arm, cancel } = useRestAlert();
  const notificationsOn = useSettings(settings => settings.notificationsEnabled && settings.notificationsGranted);

  // NOTE: recomputed from the deadline on every published tick, so the countdown needs no timer.
  const remaining = session === null ? 0 : restRemaining(session.restEndsAt, Date.now());
  const restEndsAt = session?.restEndsAt ?? null;

  // NOTE: a ref, not state: it only hands an identifier to a later handler, and state would
  // re-render a screen that already re-renders every second.
  const alertId = useRef<string | null>(null);

  // NOTE: a pip in each of the last three seconds, then the end signature. Only a rest that ran
  // out gets the second: skipping clears the deadline, an expired rest keeps it. The previous
  // reading must be one of those seconds, so returning long after a rest ended does not buzz.
  const lastRemaining = useRef(remaining);
  useEffect(() => {
    const before = lastRemaining.current;
    lastRemaining.current = remaining;
    if (remaining >= before) return;
    if (remaining > 0 && remaining <= 3) haptics.restTick();
    else if (remaining === 0 && before <= 3 && restEndsAt !== null) haptics.restOver();
  }, [restEndsAt, remaining]);

  const retract = useCallback(() => {
    const id = alertId.current;
    alertId.current = null;
    if (id !== null) cancel(id);
  }, [cancel]);

  const start = useCallback(
    (seconds: number) => {
      sessionActions.setRest(seconds);
      const live = useSessionStore.getState().session;
      if (!notificationsOn || live === null) return;
      const index = currentIndex(live);
      const name = live.entries[index]?.exerciseName ?? t('session.thisSet');
      void arm({ exerciseName: name, nextLabel: nextUpLabel(live, index, t), delaySeconds: seconds }).then(id => {
        // NOTE: a re-arm can overtake a slower earlier one; cancel what that one scheduled rather
        // than drop its identifier, or a rest the user skipped would still buzz.
        if (alertId.current !== null) cancel(alertId.current);
        alertId.current = id;
      });
    },
    [arm, cancel, notificationsOn, t],
  );

  const skip = useCallback(() => {
    retract();
    sessionActions.clearRest();
    haptics.light();
  }, [retract]);

  // NOTE: an adjustment restarts the deadline rather than nudging a label, which would snap back
  // on the next tick; below the timer's floor it clears the rest instead.
  const adjust = useCallback(
    (seconds: number) => {
      retract();
      if (seconds < MIN_REST_SECONDS) sessionActions.clearRest();
      else sessionActions.setRest(seconds);
      haptics.selection();
    },
    [retract],
  );

  return {
    remaining,
    total: session?.restDurationSeconds ?? remaining,
    start,
    retract,
    skip,
    adjust,
  };
}
