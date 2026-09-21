/**
 * HTTP transport for remote exercise data.
 *
 * Deliberately small and provider-agnostic: it knows about URLs, timeouts,
 * aborts and status codes, and nothing about exercises. Swapping wger for
 * another backend reuses this file untouched.
 *
 * Caching is *not* here. wger sends no ETag, Last-Modified or Cache-Control
 * (verified against live responses), so conditional requests would be dead
 * code; freshness is TanStack Query's responsibility, which is the right layer
 * for it anyway.
 */
import { intercept, type FaultKind } from './devFaults';

export type ApiRequestOptions = {
  /** Query parameters; undefined, null and empty-string values are dropped. */
  params?: Record<string, string | number | null | undefined>;
  /** Cancellation from the caller (TanStack Query passes one per query). */
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ApiResponse<T> = {
  data: T;
  /** `count` from a paginated payload, when present. */
  total: number | null;
};

export type ApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'cancelled'
  | 'rate-limit'
  | 'server'
  | 'not-found'
  | 'bad-request'
  | 'parse'
  | 'unknown';

/**
 * One error type for every remote failure, so the UI can branch on `kind`
 * instead of parsing strings, and the query layer can decide what is worth
 * retrying: 400s and 404s never are, 429s and 5xxs are.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Seconds to back off before retrying, when the server told us. */
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number | null; retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  get retryable(): boolean {
    return this.kind === 'rate-limit' || this.kind === 'server' || this.kind === 'timeout';
  }
}

/**
 * Long enough that a slow cellular round trip succeeds, short enough that a
 * dead connection surfaces as an error state instead of a frozen spinner.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

export function buildUrl(
  baseUrl: string,
  path: string,
  params?: ApiRequestOptions['params'],
): string {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Timeout plus caller cancellation on one signal, without relying on
 * `AbortSignal.any` (not guaranteed in the RN runtime). `dispose` must run in a
 * finally block: a leaked timer keeps the JS runtime awake and would abort a
 * signal nobody is listening to any more.
 */
function composeSignal(caller: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new ApiError('timeout', 'The request took too long')),
    timeoutMs,
  );
  const onCallerAbort = () => controller.abort(caller?.reason ?? new ApiError('cancelled', 'Cancelled'));
  if (caller) {
    if (caller.aborted) onCallerAbort();
    else caller.addEventListener('abort', onCallerAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      caller?.removeEventListener('abort', onCallerAbort);
    },
  };
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds));
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, Math.round((date - Date.now()) / 1000));
  return null;
}

function classify(status: number, retryAfter: number | null): ApiError {
  if (status === 404) return new ApiError('not-found', 'Not found', { status });
  if (status === 429)
    return new ApiError('rate-limit', 'Too many requests', { status, retryAfterSeconds: retryAfter });
  if (status >= 500) return new ApiError('server', `Server error ${status}`, { status });
  return new ApiError('bad-request', `Request rejected (${status})`, { status });
}

/* -------------------------------------------------- dev fault injection hooks -- */

/**
 * Builds an injected failure. Deliberately a `classify` sibling rather than a call to it: the
 * faults are named by kind, not by status, and the two must stay in step by inspection. Each
 * one sets the same `status` and `retryAfterSeconds` a live server would, so `retryable`: and
 * therefore the query client's backoff: behaves identically either way.
 */
function faultError(kind: FaultKind): ApiError {
  switch (kind) {
    case 'offline':
      return new ApiError('offline', 'No connection (injected)');
    case 'timeout':
      return new ApiError('timeout', 'The request took too long (injected)');
    case 'rate-limit':
      return new ApiError('rate-limit', 'Too many requests (injected)', {
        status: 429,
        retryAfterSeconds: 2,
      });
    case 'not-found':
      return new ApiError('not-found', 'Not found (injected)', { status: 404 });
    case 'bad-request':
      return new ApiError('bad-request', 'Request rejected (injected)', { status: 400 });
    case 'server':
      return new ApiError('server', 'Server error 500 (injected)', { status: 500 });
  }
}

/**
 * A cancellable wait, used to simulate latency. Cancellation matters: a search-as-you-type
 * aborts its previous query on every keystroke, so an un-abortable 3 s delay would leave three
 * abandoned promises in the runtime: and one of them resolving later is precisely the
 * stale-response bug the query layer is supposed to make impossible.
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('cancelled', 'Request cancelled'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError('cancelled', 'Request cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function countOf(data: unknown): number | null {
  const count = (data as { count?: unknown } | null)?.count;
  return typeof count === 'number' ? count : null;
}

/**
 * GETs JSON: timeouts, cancellation, typed errors. Throws `ApiError` for every
 * failure mode so callers never have to string-match an exception.
 */
export async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { params, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = buildUrl(baseUrl, path, params);

  // The dev-only fault injector, behind `__DEV__` so a release build never runs it. One guard
  // in the one function every remote call passes through, rather than a call per provider
  // method that someone could forget to add. It sits *above* `composeSignal` on purpose: an
  // injected delay is cancelled by the caller's own signal, and a throw after the composer ran
  // would skip the `finally` below and leak that timeout timer.
  if (__DEV__) {
    await intercept(url, signal, { errorFor: faultError, sleep: abortableSleep });
  }

  const composed = composeSignal(signal, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: composed.signal,
    });
  } catch (error) {
    const reason = composed.signal.reason;
    if (reason instanceof ApiError) throw reason;
    if (signal?.aborted) throw new ApiError('cancelled', 'Request cancelled');
    // RN reports connectivity failures as a bare TypeError("Network request
    // failed"). The real cause goes to the console, never to a user-facing
    // string, "Network request failed" is a terrible thing to show a screen.
    if (__DEV__) console.warn('[api] fetch failed', url, error);
    throw new ApiError('offline', 'No connection');
  } finally {
    composed.dispose();
  }

  if (!response.ok) {
    throw classify(response.status, parseRetryAfter(response.headers.get('Retry-After')));
  }

  const text = await response.text();
  try {
    const data = JSON.parse(text) as T;
    return { data, total: countOf(data) };
  } catch {
    throw new ApiError('parse', 'Malformed response from server');
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** True when a failure is really "we have no network", for offline UI states. */
export function isOfflineError(error: unknown): boolean {
  return isApiError(error) && error.kind === 'offline';
}
