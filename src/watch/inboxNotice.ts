/**
 * A watch workout the phone could not save as it is, waiting to be told to the user.
 *
 * The drain runs outside React (bootstrap, foreground, an inbox event), so it reports here and
 * `WatchInboxNotice` reads it with `useSyncExternalStore`, the same shape as the settings store.
 */
import { useSyncExternalStore } from 'react';

/** `invalid`: unreadable, set aside. `version`: from a newer watch app, kept for an update. */
export type WatchInboxProblem = 'invalid' | 'version';

let problem: WatchInboxProblem | null = null;
const listeners = new Set<() => void>();

export function reportWatchInboxProblem(next: WatchInboxProblem): void {
  // An unreadable workout is the more urgent news; it is not replaced by a version notice.
  if (problem === 'invalid') return;
  problem = next;
  for (const listener of listeners) listener();
}

export function dismissWatchInboxProblem(): void {
  problem = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWatchInboxProblem(): WatchInboxProblem | null {
  return useSyncExternalStore(subscribe, () => problem, () => problem);
}
