/**
 * React Native adapters for TanStack Query's focus and online managers.
 *
 * Verified against the installed query-core: both managers attach their default
 * listeners behind `typeof window !== 'undefined'`, and RN has no `window`, so
 * neither attaches anything. Out of the box the library therefore believes the
 * device is permanently online and permanently focused. Without this file, a query
 * that fails on a dead network is never resumed when the network returns, and
 * returning to the app never revalidates anything.
 *
 * Connectivity comes from `networkStatus.ts`, which owns the single
 * `expo-network` subscription: two sources of truth for "are we online" are
 * allowed to disagree, and the disagreement shows up as queries refusing to run.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { getNetworkStatus, subscribeNetworkStatus } from './networkStatus';

type FocusManagerLike = { setFocused: (focused?: boolean) => void };
type OnlineManagerLike = { setOnline: (online: boolean) => void };

export type QueryAdapters = { dispose: () => void };

export function setupQueryAdapters(
  focus: FocusManagerLike,
  online: OnlineManagerLike,
): QueryAdapters {
  // --- focus: `active` == focused. Background and `inactive` (transition, open
  // overlay, control centre) are not, which is the same semantics the web
  // visibility API gives.
  const applyAppState = (status: AppStateStatus): void => {
    focus.setFocused(status === 'active');
  };
  const appStateSub = AppState.addEventListener('change', applyAppState);
  applyAppState(AppState.currentState);

  // --- online. Seeded from the current snapshot, which is `true` until the probe
  // answers: a cold launch on a dead network then discovers the truth on the first
  // failed request rather than being told optimistically by the manager.
  const unsubscribeNetwork = subscribeNetworkStatus(() => {
    online.setOnline(getNetworkStatus().online);
  });
  online.setOnline(getNetworkStatus().online);

  return {
    dispose: () => {
      appStateSub.remove();
      unsubscribeNetwork();
      // Restore the library defaults so a teardown cannot leave the app stuck
      // "offline" if adapters are ever reinstalled against a fresh client.
      focus.setFocused(true);
      online.setOnline(true);
    },
  };
}
