/**
 * TanStack Query configuration.
 *
 * Two React Native facts shape this file, both verified against the installed
 * query-core rather than assumed:
 *
 * 1. There is no `window`, so `onlineManager` and `focusManager` attach nothing.
 *    Without intervention, queries would assume a connection forever and would
 *    never refetch on foreground. `adapters.ts` beside this file feeds both managers
 *    from `expo-network` and `AppState`.
 *
 * 2. wger sends no `ETag` or `Cache-Control` (checked against live responses), so
 *    there is no HTTP cache to lean on. The in-memory cache here *is* the cache:
 *    it has to survive navigation, and it is what makes an offline launch after
 *    the exercise list has been browsed once still show results.
 */
import { focusManager, MutationCache, onlineManager, QueryClient } from '@tanstack/react-query';
import { HTTP_RETRY_BUDGET, HttpError, httpRetryDelayMs, isAppError } from '@/features/core/error';
import { type QueryAdapters, setupQueryAdapters } from '@/features/core/query/adapters';

/**
 * How long a fresh result stays fresh. Two minutes is long enough that turning
 * over every tab in the app costs zero requests: the brief explicitly asks for
 * that: and short enough that returning from a gym basement picks up new data
 * without an explicit pull.
 */
const STALE_TIME_MS = 2 * 60_000;

/**
 * Remote failures retry by kind, on the budget in `core/error`. Any other app error already went
 * through its Effect, retries included, and was logged once at the boundary, so TanStack does not
 * run it again; a plain query's unknown failure keeps its one retry.
 */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof HttpError) return failureCount < HTTP_RETRY_BUDGET[error.kind];
  if (isAppError(error)) return false;
  return failureCount < HTTP_RETRY_BUDGET.unknown;
}

function retryDelay(attemptIndex: number, error: Error): number {
  return httpRetryDelayMs(attemptIndex, error instanceof HttpError ? error.retryAfterSeconds : null);
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    // NOTE: Every mutation in the app reports here. The default is that a rejected
    // mutation surfaces only through the `isError` flag on whichever hook called
    // it, and a screen that reads only `isPending`: which is to say, every screen
    // here: shows a spinner that stops spinning and a sheet that may as well have
    // succeeded. A failed write to disk then looks exactly like a successful one;
    // the notes save did precisely this, and the only evidence was data the user
    // could not see. The error is logged as an object because the stack names the
    // call site, which a `mutationKey` would only approximate: so the ten
    // mutations stay key-free and the log is still attributable.
    mutationCache: new MutationCache({
      onError: error => {
        // biome-ignore lint/suspicious/noConsole: plain mutations have no Effect boundary to log through
        console.warn('[mutation failed]', error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        // NOTE: These three are the load-bearing choices against "normal navigation must
        // not generate unnecessary repeated API requests". Tab switches keep screens
        // mounted (so focus would be the leak) and every push/pop remounts a detail
        // screen (so mount would be the leak). Cross-feature freshness instead goes
        // through explicit invalidation: finishing a workout invalidates activity
        // and progress keys: plus pull-to-refresh, which is always available.
        refetchOnReconnect: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        // NOTE: `offlineFirst`, not the library's default `online`. Most queries here read SQLite,
        // and `online` pauses every query while the OS reports no connection: in airplane
        // mode Home sat on skeletons forever, and the exercise picker said "Start typing"
        // over a request that never ran. `offlineFirst` always runs the first attempt, so a
        // local read succeeds and a remote one fails fast with the offline error the screens
        // already know how to show; only retries wait for the network.
        networkMode: 'offlineFirst',
        retry: shouldRetry,
        retryDelay,
        // NOTE: An error that survives retries stays on screen as an error state; a
        // stale-but-successful result would be nicer, but only where we have one
        // to show: see the exercise browser's `isPlaceholderData` handling.
        throwOnError: false,
      },
      // NOTE: Mutations here are local-disk writes; a retry would replay a partial
      // transaction with no way to dedupe it. `always`, because a write to disk does not
      // need a network, and under the default it would be parked until one came back.
      mutations: { retry: false, networkMode: 'always' },
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
 * Wires the focus/online managers. Returns a disposer; must be called before any query is
 * subscribed.
 */
export function installQueryAdapters(): () => void {
  if (adapters) adapters.dispose();
  adapters = setupQueryAdapters(focusManager, onlineManager);
  return () => {
    adapters?.dispose();
    adapters = null;
  };
}
