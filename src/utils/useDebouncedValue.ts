/**
 * Debounce for search text.
 *
 * Not `lodash.debounce` wrapped in a `useCallback`, which is the usual shape and the
 * wrong one here for two reasons. First, a debounced *function* fires a side effect; what
 * a query needs is a debounced *value*, so that the query key itself is the thing that
 * settles — then TanStack Query owns the request, its cancellation and its cache slot,
 * rather than a timer that survives the component it was created in. Second, a memoised
 * debouncer has to be cancelled on unmount by hand, and that cleanup is the step people
 * skip.
 *
 * The 220ms is a deliberate compromise: long enough that typing "romanian" produces one
 * request rather than eight, short enough that the result feels like it is reacting to
 * you rather than catching up.
 */
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 220): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * True while `value` has changed more recently than `delayMs` — i.e. the debounced value
 * is still behind what the user typed.
 *
 * Search fields need this: without it, a slow query looks like a dead field. With it the
 * input can show a spinner the moment a keystroke lands and stop the moment the settled
 * value catches up, which is the only feedback that says "your typing was received".
 */
export function useIsSettling(value: string, debounced: string): boolean {
  return value.trim() !== debounced.trim();
}
