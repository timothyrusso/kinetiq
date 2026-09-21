/**
 * Starting a workout from a routine.
 *
 * Lives here rather than in either screen because two screens start routines: the Workout
 * tab's "last trained" card and the routine's own detail page: and starting one wrong is not
 * a cosmetic mistake: a session that begins with the wrong rest default or a half-built entry
 * list is a session the user then trains.
 *
 * ## Why the entries come from the caller
 *
 * The caller always already has `routine.items` on screen; reading the routine again here
 * would be a second source of truth that could disagree with the rows the user is looking at
 * (an item removed in the other screen a second ago). Passing the items in means what starts
 * is what was displayed.
 *
 * ## Nothing here is async
 *
 * `startSession` is synchronous over an in-memory store and persists to SQLite on its own;
 * the session screen reads the same store. So there is no optimistic state, no pending label
 * and nothing to roll back if the navigation is interrupted. An earlier version `await`ed
 * four dynamic imports here purely to keep this file free of static imports, which bought a
 * frame of blank `busy` time and a `catch` nobody wrote: an unhandled rejection on a Start
 * button is a crash with no explanation.
 */
import { useCallback, useRef, useState } from 'react';

import { entriesFromItems } from '@/queries/useRoutines';
import { startSession } from '@/workout/session';
import type { RoutineItem } from '@/domain/types';

export type StartRoutineInput = {
  routineId: string;
  routineName: string;
  items: readonly RoutineItem[];
  defaultRestSeconds: number;
  /**
   * Called either way, with whether a session was actually created. The caller navigates on
   * `true` and explains on `false`, so the reason is phrased by the screen that has the
   * context rather than by this one.
   */
  onResult: (started: boolean) => void;
};

/**
 * Returns `{ start, busy }`.
 *
 * The re-entrancy latch is a ref, not the `busy` state read from a closure: two taps in the
 * same frame both see the state as it was when the callback was created, so a state-based
 * guard lets the second one through: and a second `startSession` call replaces the session
 * that was just created, which the user experiences as the screen changing and then changing
 * back. `busy` is still published for the button's spinner.
 */
export function useStartRoutine() {
  const starting = useRef(false);
  const [busy, setBusy] = useState(false);

  const start = useCallback((input: StartRoutineInput) => {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    try {
      if (input.items.length === 0) {
        // An untrained empty routine is a real state: everything removed but not yet
        // deleted: and it must not navigate to a session with nothing in it.
        input.onResult(false);
        return;
      }
      startSession({
        routineId: input.routineId,
        routineName: input.routineName,
        entries: entriesFromItems(input.items),
        defaultRestSeconds: input.defaultRestSeconds,
      });
      input.onResult(true);
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }, []);

  return { start, busy };
}
