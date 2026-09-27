import type { QueryClient } from '@tanstack/react-query';

/**
 * The routines' query keys. Every key sits under `routines`, which is also the prefix a finished
 * workout invalidates to refresh a routine's trained count.
 */
export const routineQueryKeys = {
  all: ['routines'] as const,
  list: () => ['routines', 'list'] as const,
  detail: (id: string) => ['routines', 'detail', id] as const,
};

/**
 * After a write to routine `id`: its detail and the list both re-read. The list shows every
 * routine's exercise count and name, so any write can change it. Every read is a couple of
 * indexed queries, cheaper than patching the cache and never wrong.
 */
export function refreshRoutine(client: QueryClient, id: string): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: routineQueryKeys.detail(id) }),
    client.invalidateQueries({ queryKey: routineQueryKeys.list() }),
  ]).then(() => undefined);
}

/**
 * After routine `id` was deleted: its detail leaves the cache, so a screen still showing it does
 * not render it again on the way out, and the list re-reads.
 */
export function forgetRoutine(client: QueryClient, id: string): Promise<void> {
  client.removeQueries({ queryKey: routineQueryKeys.detail(id) });
  return client.invalidateQueries({ queryKey: routineQueryKeys.list() });
}
