/**
 * One subscription to `expo-network`, fanned out to everyone who cares.
 *
 * Both TanStack Query (via the online manager) and the UI (offline banners, the
 * exercise browser's empty-vs-offline distinction) need this answer, and a second
 * subscription would be a second source of truth allowed to disagree with the
 * first. `startNetworkStatus()` is idempotent, so bootstrap can call it without
 * caring whether a hook already needed it.
 *
 * `isInternetReachable` is `null` on Android until the network has been validated,
 * so unknown counts as online: guessing "offline" there would freeze the app with
 * a working connection, while guessing "online" costs one failed request.
 */
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

export type NetworkStatus = {
  online: boolean;
  /** False until the first probe answers, so a cold launch shows a skeleton, not "offline". */
  known: boolean;
};

const listeners = new Set<() => void>();
let status: NetworkStatus = { online: true, known: false };
let stop: (() => void) | null = null;

function publish(next: NetworkStatus): void {
  if (next.online === status.online && next.known === status.known) return;
  status = next;
  for (const listener of listeners) listener();
}

export function startNetworkStatus(): () => void {
  if (stop) return stop;

  const subscription = addNetworkStateListener((state) => {
    publish({ online: state.isInternetReachable !== false, known: true });
  });

  void getNetworkStateAsync()
    .then((state) => {
      publish({ online: state.isInternetReachable !== false, known: true });
    })
    .catch(() => {
      publish({ online: true, known: true });
    });

  stop = () => {
    subscription.remove();
    stop = null;
    status = { online: true, known: false };
  };
  return stop;
}

export function getNetworkStatus(): NetworkStatus {
  return status;
}

export function subscribeNetworkStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
