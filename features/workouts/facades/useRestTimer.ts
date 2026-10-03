import { useCallback, useEffect, useRef } from 'react';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import { type RestNextUp, useRestAlert } from '@/features/notifications';
import { useSettings } from '@/features/settings';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { restRemaining } from '@/features/workouts/domain/utils/workoutMath';
import { sessionActions } from '@/features/workouts/facades/useActiveSession';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

/** Below this a rest cannot be held (the timer floors at five seconds), so it is cleared instead. */
const MIN_REST_SECONDS = 5;

/**
 * The exercise the rest follows: the one whose set was ticked, or the current one for a rest
 * that does not know (restored from disk), clamped: a restored session can point past its end.
 */
function restIndex(session: WorkoutSession, entryIndex: number | null): number {
  if (entryIndex !== null && entryIndex < session.entries.length) return entryIndex;
  return Math.min(session.activeIndex, Math.max(0, session.entries.length - 1));
}

const hasOpenSet = (entry: StrengthEntry) => entry.sets.some(set => !set.completed);

/**
 * What comes after this rest: the first open set of the rest's exercise, else the next exercise
 * with a set open (below it, then from the top, since a set can be ticked anywhere in the list),
 * else nothing, which says the workout is done.
 */
function nextUp(session: WorkoutSession, index: number): RestNextUp {
  const entry = session.entries[index];
  if (!entry) return { kind: 'none' };
  const open = entry.sets.findIndex(set => !set.completed);
  if (open >= 0) return { kind: 'set', set: open + 1, total: entry.sets.length };
  const next = session.entries.slice(index + 1).find(hasOpenSet) ?? session.entries.slice(0, index).find(hasOpenSet);
  return next === undefined ? { kind: 'none' } : { kind: 'exercise', name: next.exerciseName };
}

/**
 * The rest between sets: the countdown read from the deadline, its haptics, and the alert that
 * fires at its end while the phone is in a pocket.
 *
 * The alert names the exercise whose set started the rest, which the session keeps beside the
 * deadline, so an adjustment or a late grant names it too. It is armed when a rest starts and
 * retracted only by what ends that rest early: an unticked set, a skip, an adjusted or re-armed
 * rest, the workout's last exercise removed, a finish or a discard. Leaving the screen mid-rest
 * is exactly what it exists for, so an unmount does not retract it. Every handler is stable and
 * reads the session at call time, because the screen re-renders every second.
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

  // NOTE: a rest the session ended on its own (its last exercise removed, so nothing is left to
  // rest for) pulls back its alert too; the handlers below that end one retract it themselves.
  const hadRest = useRef(restEndsAt !== null);
  useEffect(() => {
    const before = hadRest.current;
    hadRest.current = restEndsAt !== null;
    if (before && restEndsAt === null) retract();
  }, [restEndsAt, retract]);

  const armFor = useCallback(
    (seconds: number) => {
      const { session: live, restEntryIndex } = useSessionStore.getState();
      if (live === null) return;
      const index = restIndex(live, restEntryIndex);
      const name = live.entries[index]?.exerciseName ?? t('session.thisSet');
      void arm({ exerciseName: name, next: nextUp(live, index), delaySeconds: seconds }).then(id => {
        // NOTE: a re-arm can overtake a slower earlier one; cancel what that one scheduled rather
        // than drop its identifier, or a rest the user skipped would still buzz.
        if (alertId.current !== null) cancel(alertId.current);
        alertId.current = id;
      });
    },
    [arm, cancel, t],
  );

  const start = useCallback(
    (seconds: number, entryIndex: number | null) => {
      sessionActions.setRest(seconds, entryIndex);
      if (notificationsOn) armFor(seconds);
    },
    [armFor, notificationsOn],
  );

  // NOTE: a grant that arrives mid-rest (the prompt at the start, or the system settings) arms the
  // rest already running for the time it has left. Only on the change: a remount with alerts
  // already on would arm a second alert for a rest that has one.
  const wasOn = useRef(notificationsOn);
  useEffect(() => {
    const before = wasOn.current;
    wasOn.current = notificationsOn;
    if (before || !notificationsOn) return;
    const live = useSessionStore.getState().session;
    const left = live === null ? 0 : restRemaining(live.restEndsAt, Date.now());
    if (left > 0) armFor(left);
  }, [armFor, notificationsOn]);

  const skip = useCallback(() => {
    retract();
    sessionActions.clearRest();
    haptics.light();
  }, [retract]);

  // NOTE: an adjustment restarts the deadline rather than nudging a label, which would snap back
  // on the next tick, and arms the alert for that new deadline; below the timer's floor it clears
  // the rest instead.
  const adjust = useCallback(
    (seconds: number) => {
      retract();
      if (seconds < MIN_REST_SECONDS) sessionActions.clearRest();
      else start(seconds, useSessionStore.getState().restEntryIndex);
      haptics.selection();
    },
    [retract, start],
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
