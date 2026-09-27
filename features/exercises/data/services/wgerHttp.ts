import { Clock, Duration, Effect, Schedule } from 'effect';
import { HTTP_RETRY_BUDGET, HttpError, httpRetryDelayMs, OfflineError } from '@/features/core/error';

/** Per request. An `exerciseinfo` page of 100 rows is close to a megabyte of JSON. */
const REQUEST_TIMEOUT = Duration.seconds(60);

/** The slice of `fetch` the client uses, so a test can answer with its own responses. */
export type FetchImpl = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Response>;

type WgerHttpFailure = HttpError | OfflineError;

/** `Retry-After` as seconds, from either form the header takes: a number, or an HTTP date. */
function parseRetryAfter(header: string | null, now: number): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds));
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, Math.round((date - now) / 1000));
  return null;
}

function statusFailure(status: number, retryAfterSeconds: number | null): HttpError {
  if (status === 404) return new HttpError({ kind: 'not-found', status, retryAfterSeconds: null });
  if (status === 429) return new HttpError({ kind: 'rate-limit', status, retryAfterSeconds });
  if (status >= 500) return new HttpError({ kind: 'server', status, retryAfterSeconds: null });
  return new HttpError({ kind: 'bad-request', status, retryAfterSeconds: null });
}

const kindOf = (failure: WgerHttpFailure) => (failure instanceof OfflineError ? 'offline' : failure.kind);

/**
 * Retries a failed request on the app's budget for its kind (`HTTP_RETRY_BUDGET`), waiting the
 * server's `Retry-After` when it sent one and an exponential backoff otherwise.
 */
const retryBudget = Schedule.identity<WgerHttpFailure>().pipe(
  Schedule.intersect(Schedule.count),
  Schedule.whileOutput(([failure, retries]) => retries < HTTP_RETRY_BUDGET[kindOf(failure)]),
  Schedule.addDelay(([failure, retries]) =>
    Duration.millis(httpRetryDelayMs(retries, failure instanceof HttpError ? failure.retryAfterSeconds : null)),
  ),
);

/**
 * GETs `url` and succeeds with its parsed JSON body. A connection that fails is an
 * `OfflineError`; a status, a timeout or a body that is not JSON is an `HttpError` of that kind.
 * Each attempt has its own timeout, and a failed attempt is retried on the budget above.
 */
export const makeWgerGetJson =
  (fetchImpl: FetchImpl) =>
  (url: string): Effect.Effect<unknown, WgerHttpFailure> =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: signal => fetchImpl(url, { headers: { Accept: 'application/json' }, signal }),
        catch: cause => new OfflineError({ cause }),
      });
      if (!response.ok) {
        const now = yield* Clock.currentTimeMillis;
        return yield* statusFailure(response.status, parseRetryAfter(response.headers.get('Retry-After'), now));
      }
      const text = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: cause => new HttpError({ kind: 'unknown', status: response.status, retryAfterSeconds: null, cause }),
      });
      return yield* Effect.try({
        try: (): unknown => JSON.parse(text),
        catch: cause => new HttpError({ kind: 'parse', status: response.status, retryAfterSeconds: null, cause }),
      });
    }).pipe(
      Effect.timeoutFail({
        duration: REQUEST_TIMEOUT,
        onTimeout: () => new HttpError({ kind: 'timeout', status: null, retryAfterSeconds: null }),
      }),
      Effect.retry(retryBudget),
    );
