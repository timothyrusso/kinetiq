/**
 * Development-only fault injection and request accounting.
 *
 * ## Why this exists at the transport rather than in the UI
 *
 * The brief requires the app to be *verified* against a failing API — error states, retry,
 * slow responses, reconnect — and none of that is reachable on demand from a simulator
 * otherwise. Turning off Wi-Fi is a manual step that also breaks the dev server, and waiting
 * for wger to have a real outage is not a test. Injecting at the one function every remote
 * call passes through means the failure is the genuine article: an `ApiError` thrown from the
 * same line a real 500 would throw from, so the retry policy, the error states and TanStack
 * Query's backoff are all exercised rather than a stub of them.
 *
 * ## Why it is not a provider swap
 *
 * `setExerciseProviderForTests` exists and replaces the whole port. That tests the UI against
 * a fake *backend*; it cannot test the transport's classification of a 429 with a
 * `Retry-After`, or that a cancelled query never resolves into state. Different seam, and
 * this is the one that was missing.
 *
 * ## This module knows nothing about HTTP
 *
 * The error and delay builders are handed in by `http.ts` rather than imported. That keeps
 * the dependency one-way (transport → here, never back), and it means an injected failure is
 * produced by the same `classify()` that produces a real one: "indistinguishable from a real
 * outage" is enforced by the code path, not asserted by a comment.
 *
 * ## Cost in production
 *
 * The call site is inside `if (__DEV__)`, so a release build performs one falsy check. The
 * entry point is `async` regardless, which costs a resolved microtask per request — not worth
 * restructuring for, since a promise tick is unmeasurable against a network round trip, but
 * worth naming. Faults live in memory only and reset on relaunch, so nobody can leave a device
 * permanently failing, and no build pays a disk read to ask whether faults are on.
 */

/** The failure modes worth simulating. `cancelled` and `parse` are excluded because those are
 *  the transport's own behaviour, not a server's, and arming them would test the harness. */
export type FaultKind = 'offline' | 'timeout' | 'rate-limit' | 'server' | 'not-found' | 'bad-request';

export type InjectedFault = {
  /** The failure to throw, or `null` to only add latency and then succeed. */
  kind: FaultKind | null;
  /** Apply to this many requests, then clear itself. At least 1. */
  remaining: number;
  /** Extra latency before the failure, or before the success. */
  delayMs: number;
};

/** What `http.ts` supplies so this file can stay transport-agnostic. */
export type FaultBuilders = {
  errorFor: (kind: FaultKind) => unknown;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

let fault: InjectedFault | null = null;

/** Every remote request that reached the transport since launch, for the refetch-loop check. */
let requestCount = 0;
/** Paths seen, with how often — a repeated key is what a request loop looks like in the open. */
const seen = new Map<string, number>();

/**
 * Makes the next `times` requests fail with `kind`, optionally after a delay. A `delayMs`
 * with `kind: null` only slows them down and then succeeds, which is the other half of the QA:
 * an error state and a skeleton are different screens, and both have to be reachable on demand.
 */
export function armFault(kind: FaultKind | null, times = 1, delayMs = 0): void {
  fault = { kind, remaining: Math.max(1, times), delayMs: Math.max(0, delayMs) };
}

export function clearFault(): void {
  fault = null;
}

export function activeFault(): InjectedFault | null {
  return fault;
}

/** Text for the dev screen's status line: what is armed, and what it will do. */
export function faultSummary(): string {
  if (!fault) return 'No fault armed — requests go to wger normally.';
  const times = fault.remaining === 1 ? 'next request' : `next ${fault.remaining} requests`;
  const slow = fault.delayMs > 0 ? `, after ${fault.delayMs} ms` : '';
  if (fault.kind === null) return `Slowing the ${times}${slow}, then succeeding.`;
  return `Failing the ${times} with "${fault.kind}"${slow}.`;
}

export function requestLog(): {
  total: number;
  entries: readonly { path: string; count: number }[];
} {
  return {
    total: requestCount,
    entries: [...seen.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
  };
}

export function resetRequestLog(): void {
  requestCount = 0;
  seen.clear();
}

function pathOnly(url: string): string {
  // Query parameters are dropped. The point is spotting the *same query* firing repeatedly:
  // `?page=2` firing once is fine and `?page=2` firing forty times is the bug, so splitting a
  // looping query across a hundred parameterised entries would hide exactly what this is for.
  const withoutOrigin = url.replace(/^[a-z]+:\/\/[^/]+/i, '');
  return withoutOrigin.split('?')[0] ?? withoutOrigin;
}

/**
 * Called by `requestJson` before it touches the network. Resolves when the request should
 * proceed; throws what a real failure would have thrown. `builders` comes from the transport so
 * that an injected 429 is the same object a real 429 produces, `retryAfterSeconds` included.
 */
export async function intercept(
  url: string,
  signal: AbortSignal | undefined,
  builders: FaultBuilders,
): Promise<void> {
  requestCount += 1;
  seen.set(pathOnly(url), (seen.get(pathOnly(url)) ?? 0) + 1);

  if (!fault) return;
  if (fault.delayMs > 0) await builders.sleep(fault.delayMs, signal);

  // Captured before disarming, or the final injected failure of a `times: 1` fault would fall
  // through to the "slow only, then succeed" branch instead of failing.
  const kind = fault.kind;
  fault.remaining -= 1;
  if (fault.remaining <= 0) fault = null;

  if (kind !== null) throw builders.errorFor(kind);
}
