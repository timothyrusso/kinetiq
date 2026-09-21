/**
 * How many sheets are mounted right now.
 *
 * A tab screen's sheet cannot rise above the tab bar, and this is the one place the
 * layout could not solve with z-index: `TabBar` is painted by the navigator, in a
 * different view hierarchy than the scene the sheet lives in, so no `zIndex` the sheet
 * sets reaches it. The cost was concrete: the bar occupies the bottom 60+inset points,
 * which is exactly where a sheet's footer sits, so "Delete this session?" rendered with
 * its Cancel and Delete buttons *underneath* the bar, and a tap in that band switched
 * tab instead of dismissing the sheet.
 *
 * So the bar gets out of the way while a sheet is up, which is what the platform's own
 * action sheets do. Presence, not intent: `Sheet` publishes on mount and retracts on
 * unmount, and every sheet in the app is mounted conditionally, so mounted means open.
 *
 * Refcounted rather than boolean because two sheets can be up at once (a confirm over a
 * routine's options sheet). The bar must come back when the *last* one closes, not the
 * first.
 */
import { useEffect, useSyncExternalStore } from 'react';

let mounted = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Marks a sheet present until the returned function runs. Idempotent on release. */
function acquire(): () => void {
  mounted += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    mounted -= 1;
    emit();
  };
}

/**
 * Publishes one sheet's presence for as long as it is mounted.
 *
 * The StrictMode double-invoke is the reason for the release guard: React runs
 * mount → unmount → mount in development, and a careless release would leave the count
 * at −1, which `> 0` reads the same as zero: but the second acquire then pairs with
 * nothing, and the bar stays hidden after the sheet closes.
 */
export function useSheetPresence(): void {
  useEffect(() => acquire(), []);
}

export function subscribeSheets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function anyMounted(): boolean {
  return mounted > 0;
}

/** True while at least one sheet is on screen. Returns a boolean, so the
 * `Object.is` comparison `useSyncExternalStore` makes is a real comparison. */
export function useAnySheetMounted(): boolean {
  return useSyncExternalStore(subscribeSheets, anyMounted, anyMounted);
}
