/**
 * The React Native adapter for TanStack Query's focus manager.
 *
 * Verified against the installed query-core: the manager attaches its default listener behind
 * `typeof window !== 'undefined'`, and RN has no `window`, so it attaches nothing. Out of the box
 * the library therefore believes the app is permanently focused, and a query that asks to
 * refetch on focus never does. The online manager needs no adapter: the app makes no network
 * requests, and the library's default (always online) is the truth.
 */
import { AppState, type AppStateStatus } from 'react-native';

type FocusManagerLike = { setFocused: (focused?: boolean) => void };

export type QueryAdapters = { dispose: () => void };

export function setupQueryAdapters(focus: FocusManagerLike): QueryAdapters {
  // NOTE: `active` == focused. Background and `inactive` (transition, open overlay, control
  // centre) are not, which is the same semantics the web visibility API gives.
  const applyAppState = (status: AppStateStatus): void => {
    focus.setFocused(status === 'active');
  };
  const appStateSub = AppState.addEventListener('change', applyAppState);
  applyAppState(AppState.currentState);

  return {
    dispose: () => {
      appStateSub.remove();
      // NOTE: Restore the library default so a teardown cannot leave the app stuck unfocused if
      // the adapter is ever reinstalled against a fresh client.
      focus.setFocused(true);
    },
  };
}
