import { type MutateOptions, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useEffectMutation } from '@/features/core/query';
import type { Exercise } from '@/features/exercises';
import type { ItemChange, ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { forgetRoutine, refreshRoutine, routineQueryKeys } from '@/features/routines/facades/routineQueryKeys';
import { addRoutineItem } from '@/features/routines/useCases/addRoutineItem';
import { deleteRoutine } from '@/features/routines/useCases/deleteRoutine';
import { duplicateRoutine } from '@/features/routines/useCases/duplicateRoutine';
import type { RoutineDetail } from '@/features/routines/useCases/getRoutineDetail';
import { removeRoutineItem } from '@/features/routines/useCases/removeRoutineItem';
import { renameRoutine } from '@/features/routines/useCases/renameRoutine';
import { reorderRoutine } from '@/features/routines/useCases/reorderRoutine';
import { setRoutineItem } from '@/features/routines/useCases/setRoutineItem';

/**
 * Every write to a saved routine invalidates rather than patches the cache: the items are replaced
 * or renumbered on disk, and re-reading costs a couple of indexed queries and cannot disagree with
 * the database. Only an item's targets are optimistic (see `useSetRoutineItem`): a reorder drawn
 * before it commits could be dragged again against a stale order.
 */

export function useDeleteRoutine() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: (id: RoutineId) => deleteRoutine(id),
    onSuccess: (_done, id) => forgetRoutine(client, id),
  });
}

/** Returns the copy, so the caller can open it at once. */
export function useDuplicateRoutine() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: (id: RoutineId) => duplicateRoutine(id),
    onSuccess: copy => refreshRoutine(client, copy.id),
  });
}

export function useRenameRoutine() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: ({ id, name }: { readonly id: RoutineId; readonly name: string }) => renameRoutine(id, name),
    onSuccess: (_done, { id }) => refreshRoutine(client, id),
  });
}

/**
 * Takes the whole ordered id list the screen shows, not a from and to index: an index means
 * something else once a concurrent write has landed, the list does not.
 */
export function useReorderRoutine() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: ({ id, orderedItemIds }: { readonly id: RoutineId; readonly orderedItemIds: readonly string[] }) =>
      reorderRoutine(id, orderedItemIds),
    onSuccess: (_done, { id }) => refreshRoutine(client, id),
  });
}

const SET_ITEM_KEY = ['routines', 'setItem'] as const;

type SetItemWrite = { readonly routineId: RoutineId; readonly itemId: string; readonly patch: Partial<ItemTarget> };

/**
 * Applies `change` to item `itemId` as the cached routine holds it now, and returns the patch it
 * made: nothing when the routine or the item is not in the cache.
 */
function changeCachedItem(
  client: QueryClient,
  routineId: RoutineId,
  itemId: string,
  change: ItemChange,
): Partial<ItemTarget> | null {
  const key = routineQueryKeys.detail(routineId);
  const detail = client.getQueryData<RoutineDetail | null>(key);
  const item = detail?.routine.items.find(row => row.id === itemId);
  if (detail == null || item === undefined) return null;
  const patch = change(item);
  // NOTE: A read in flight would land the item from before this edit over it; cancelling one first
  // puts back what it started from, which this then patches.
  void client.cancelQueries({ queryKey: key });
  const items = detail.routine.items.map(row => (row.id === itemId ? { ...row, ...patch } : row));
  client.setQueryData<RoutineDetail>(key, { ...detail, routine: { ...detail.routine, items } });
  return patch;
}

/**
 * Edits one item's targets, optimistically: `change` is applied to the cached routine at once, so
 * the sheet draws the edit and the next edit builds on it, and the patch it made is written.
 *
 * The cache is patched synchronously, in `change`, not in `onMutate`, which runs a tick later: two
 * edits in the same tick would both read the item from before either. The writes run one at a time
 * (`scope`), so they land in the order they were made. Nothing re-reads the detail while one is in
 * flight, which would draw the item from before the writes still queued: once the last settles the
 * detail is marked stale for the next screen and the list re-reads, and a failure re-reads the
 * detail too, which is the rollback.
 */
export function useSetRoutineItem() {
  const client = useQueryClient();
  const failed = useRef(false);
  const mutation = useEffectMutation({
    mutationKey: SET_ITEM_KEY,
    scope: { id: SET_ITEM_KEY.join(':') },
    mutationFn: ({ itemId, patch }: SetItemWrite) => setRoutineItem(itemId, patch),
    onError: () => {
      failed.current = true;
    },
    onSettled: (_done, _error, { routineId }) => {
      if (client.isMutating({ mutationKey: SET_ITEM_KEY }) > 1) return;
      const rollback = failed.current;
      failed.current = false;
      if (rollback) return refreshRoutine(client, routineId);
      return Promise.all([
        client.invalidateQueries({ queryKey: routineQueryKeys.detail(routineId), refetchType: 'none' }),
        client.invalidateQueries({ queryKey: routineQueryKeys.list() }),
      ]);
    },
  });
  const { mutate, isPending, error } = mutation;
  const change = useCallback(
    (
      {
        routineId,
        itemId,
        change: edit,
      }: { readonly routineId: RoutineId; readonly itemId: string; readonly change: ItemChange },
      options?: MutateOptions<void, unknown, SetItemWrite>,
    ) => {
      const patch = changeCachedItem(client, routineId, itemId, edit);
      if (patch !== null) mutate({ routineId, itemId, patch }, options);
    },
    [client, mutate],
  );
  return { change, isPending, error };
}

/** Adds an exercise from the library, storing its snapshot before the item points at it. */
export function useAddRoutineExercise() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: ({
      routineId,
      exercise,
      item,
    }: {
      readonly routineId: RoutineId;
      readonly exercise: Exercise;
      readonly item: ItemTarget;
    }) => addRoutineItem(routineId, exercise, item),
    onSuccess: (_done, { routineId }) => refreshRoutine(client, routineId),
  });
}

export function useRemoveRoutineItem() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: ({ routineId, itemId }: { readonly routineId: RoutineId; readonly itemId: string }) =>
      removeRoutineItem(routineId, itemId),
    onSuccess: (_done, { routineId }) => refreshRoutine(client, routineId),
  });
}
