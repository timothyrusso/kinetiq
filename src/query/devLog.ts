/**
 * Dev-only request inspector.
 *
 * The brief asks for verification that navigation does not cause repeated
 * requests, that pagination never duplicates, and that there are no retry loops.
 * Those claims are only checkable by watching actual fetch counts, so instead of
 * guessing from the code this keeps a rolling log of every query lifecycle event
 * and exposes it to `src/dev/QueryInspector.tsx`.
 *
 * It is a subscriber to the caches, not a wrapper around the fetcher: that keeps
 * it out of the request path entirely, and it sees cache-level truth (a query
 * served from cache produces no `fetch` event, which is exactly the fact under
 * test).
 */
import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

export type QueryLogKind = 'fetch' | 'success' | 'error' | 'reset';

export type QueryLogEntry = {
  seq: number;
  kind: QueryLogKind;
  /** Readable key, e.g. `exercises/list q="bench" cat=0`. */
  key: string;
  atMs: number;
  /** Wall duration for a settled event. */
  durationMs: number | null;
  error: string | null;
  /** Pages currently held, for infinite queries: the duplicate detector's input. */
  pageCount: number | null;
};

export type QueryLogSnapshot = {
  version: number;
  entries: readonly QueryLogEntry[];
  /** Total fetches per key since launch: the "did tab switching re-request?" answer. */
  fetchCounts: ReadonlyMap<string, number>;
  inflight: number;
};

const MAX_ENTRIES = 120;

let version = 0;
let seq = 0;
let inflight = 0;
let entries: QueryLogEntry[] = [];
const fetchCounts = new Map<string, number>();
const startedAt = new Map<string, number>();
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;
let snapshot: QueryLogSnapshot = build();

function build(): QueryLogSnapshot {
  return {
    version,
    entries,
    fetchCounts: new Map(fetchCounts),
    inflight,
  };
}

function emit(): void {
  version += 1;
  snapshot = build();
  for (const listener of listeners) listener();
}

function push(entry: Omit<QueryLogEntry, 'seq'>): void {
  seq += 1;
  entries = [{ ...entry, seq }, ...entries].slice(0, MAX_ENTRIES);
}

export function keyToString(key: readonly unknown[]): string {
  return key
    .map((part) => {
      if (typeof part === 'string' || typeof part === 'number') return String(part);
      if (part === null || part === undefined) return 'null';
      try {
        return JSON.stringify(part);
      } catch {
        return '[unserialisable]';
      }
    })
    .join(' ');
}

function pageCountOf(data: unknown): number | null {
  if (data && typeof data === 'object' && Array.isArray((data as { pages?: unknown }).pages)) {
    return (data as { pages: unknown[] }).pages.length;
  }
  return null;
}

/**
 * Attaches to the client's caches. Called once by `installQueryAdapters`; a
 * second call replaces the first so a hot reload cannot double-count.
 */
export function attachQueryLogger(client: QueryClient): () => void {
  detach?.();
  const cache = client.getQueryCache();

  const unsubscribe = cache.subscribe((event) => {
    if (event.type !== 'updated') return;
    const query = event.query;
    const key = keyToString(query.queryKey);
    const action = event.action as { type?: string };

    if (action.type === 'fetch') {
      inflight += 1;
      fetchCounts.set(key, (fetchCounts.get(key) ?? 0) + 1);
      startedAt.set(key, Date.now());
      push({
        kind: 'fetch',
        key,
        atMs: Date.now(),
        durationMs: null,
        error: null,
        pageCount: pageCountOf(query.state.data),
      });
      emit();
      return;
    }

    if (action.type === 'success' || action.type === 'error') {
      const began = startedAt.get(key);
      // A settle without a preceding fetch is a cache hit or a cancelled attempt;
      // counting it as a fetch would misreport exactly the thing being measured.
      if (began === undefined && action.type === 'success') return;
      inflight = Math.max(0, inflight - 1);
      startedAt.delete(key);
      push({
        kind: action.type,
        key,
        atMs: Date.now(),
        durationMs: began === undefined ? null : Date.now() - began,
        error: action.type === 'error' ? String(query.state.error?.message ?? 'error') : null,
        pageCount: pageCountOf(query.state.data),
      });
      emit();
    }
  });

  detach = () => {
    unsubscribe();
    detach = null;
  };
  return detach;
}

export function resetQueryLog(): void {
  entries = [];
  fetchCounts.clear();
  startedAt.clear();
  inflight = 0;
  seq = 0;
  emit();
}

export function readQueryLog(): QueryLogSnapshot {
  return snapshot;
}

function subscribeLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useQueryLog(): QueryLogSnapshot {
  // Module-level `subscribeLog`, not an inline closure: an unstable subscribe
  // function makes React detach and reattach on every render.
  return useSyncExternalStore(subscribeLog, readQueryLog, readQueryLog);
}
