import type { HttpErrorKind } from '@/features/core/error/domain/entities/HttpErrorKind';

/**
 * How many times a remote call is retried, by failure kind: 2 means at most three attempts. A 429
 * is a real rate limit with the server's own backoff, while an offline failure is never retried:
 * the connection is gone, and hammering it drains battery and makes a dead network look slow.
 */
export const HTTP_RETRY_BUDGET: Readonly<Record<HttpErrorKind, number>> = {
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

/**
 * The longest a `Retry-After` is honoured. A server asking for an hour is saying "not now": waiting
 * that long would hold a catalog refresh (and its spinner) for the whole budget of retries, so the
 * wait is capped and a still-limited server fails the request, which the next launch tries again.
 */
const RETRY_AFTER_CAP_MS = 60_000;

/**
 * The wait before retry `attemptIndex` (0 for the first retry): the server's `Retry-After` when
 * it sent one, between a one second floor, so `Retry-After: 0` cannot become a hot loop, and a
 * one minute cap; otherwise an exponential backoff capped at 20 seconds.
 */
export function httpRetryDelayMs(attemptIndex: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds !== null) return Math.min(RETRY_AFTER_CAP_MS, Math.max(1_000, retryAfterSeconds * 1_000));
  return Math.min(20_000, 300 * 2 ** attemptIndex);
}
