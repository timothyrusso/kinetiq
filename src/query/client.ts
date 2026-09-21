/**
 * TanStack Query configuration.
 *
 * Two React Native facts shape this file, both verified against the installed
 * query-core rather than assumed:
 *
 * 1. There is no `window`, so `onlineManager` and `focusManager` attach nothing.
 *    Without intervention, queries would assume a connection forever and would
 *    never refetch on foreground. `src/query/adapters.ts` feeds both managers
 *    from `expo-network` and `AppState`.
 *
 * 2. wger sends no `ETag` or `Cache-Control` (checked against live responses), so
 *    there is no HTTP cache to lean on. The in-memory cache here *is* the cache:
 *    it has to survive navigation, and it is what makes an offline launch after
 *    the exercise list has been browsed once still show results.
 */
import { MutationCache, QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { isApiError, type ApiError } from '@/api';
import { attachQueryLogger } from './devLog';
import { setupQueryAdapters, type QueryAdapters } from './adapters';

/**
 * How long a fresh result stays fresh. Two minutes is long enough that turning
 * over every tab in the app costs zero requests: the brief explicitly asks for
 * that: and short enough that returning from a gym basement picks up new data
 * without an explicit pull.
 */
const STALE_TIME_MS = 2 * 60_000;

/**
 * Retry budget by failure kind. The count is the number of *retries*, so 2 means
 * at most three attempts.
 *
 * The distinction that matters: a 429 from wger is a real rate limit and
 * `retryAfterSeconds` tells us how long to wait, while an offline error must not
 * be retried at all: the connection is gone, and hammering it drains battery and
 * makes a dead network look like a slow one. Offline recovery is the `online`
 * manager's job: it resumes paused mutations and refetches pending queries the
 * moment the interface comes back.
 */
export const RETRY_BUDGET: Record<ApiError['kind'], number> = {
  'rate-limit': 3,
  timeout: 2,
  server: 2,
  offline: 0,
  cancelled: 0,
  'not-found': 0,
  'bad-request': 0,
  parse: 0,
  unknown: 1,
};

export function shouldRetry(failureCount: number, error: Error): boolean {
  const kind = isApiError(error) ? error.kind : 'unknown';
  return failureCount < (RETRY_BUDGET[kind] ?? 0);
}

export function retryDelay(attemptIndex: number, error: Error): number {
  if (isApiError(error) && error.retryAfterSeconds !== null) {
    // Honour the server's own backoff, with a floor so a `Retry-After: 0` cannot
    // turn into a hot loop.
    return Math.max(1_000, error.retryAfterSeconds * 1_000);
  }
  return Math.min(20_000, 300 * 2 ** attemptIndex);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // Every mutation in the app reports here. The default is that a rejected
    // mutation surfaces only through the `isError` flag on whichever hook called
    // it, and a screen that reads only `isPending`: which is to say, every screen
    // here: shows a spinner that stops spinning and a sheet that may as well have
    // succeeded. A failed write to disk then looks exactly like a successful one;
    // the notes save did precisely this, and the only evidence was data the user
    // could not see. The error is logged as an object because the stack names the
    // call site, which a `mutationKey` would only approximate: so the ten
    // mutations stay key-free and the log is still attributable.
    mutationCache: new MutationCache({
      onError: (error) => {
        console.warn('[mutation failed]', error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        // These three are the load-bearing choices against "normal navigation must
        // not generate unnecessary repeated API requests". Tab switches keep screens
        // mounted (so focus would be the leak) and every push/pop remounts a detail
        // screen (so mount would be the leak). Cross-feature freshness instead goes
        // through explicit invalidation: finishing a workout invalidates activity
        // and progress keys: plus pull-to-refresh, which is always available.
        refetchOnReconnect: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay,
        // An error that survives retries stays on screen as an error state; a
        // stale-but-successful result would be nicer, but only where we have one
        // to show: see the exercise browser's `isPlaceholderData` handling.
        throwOnError: false,
      },
      // Mutations here are local-disk writes; a retry would replay a partial
      // transaction with no way to dedupe it.
      mutations: { retry: false },
    },
  });
}

let client: QueryClient | null = null;
let adapters: QueryAdapters | null = null;

/**
 * The app-wide client. Created eagerly rather than inside a provider so that
 * non-component code: the workout session engine, prefetch on screen focus, the
 * post-workout invalidation: reaches the same instance without prop drilling.
 */
export function getQueryClient(): QueryClient {
  if (!client) client = createQueryClient();
  return client;
}

/**
 * Wires the focus/online managers. Returns a disposer; must be called after the
 * client exists, and before any query is subscribed.
 */
export function installQueryAdapters(): () => void {
  const instance = getQueryClient();
  if (adapters) adapters.dispose();
  adapters = setupQueryAdapters(focusManager, onlineManager);
  const stopLogging = __DEV__ ? attachQueryLogger(instance) : () => {};
  return () => {
    adapters?.dispose();
    adapters = null;
    stopLogging();
  };
}

/** Test seam: a fresh client per case, with no native subscriptions left behind. */
export function resetQueryClientForTests(next?: QueryClient): void {
  adapters?.dispose();
  adapters = null;
  client = next ?? null;
}
