import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@/features/core/query';
import type { Exercise } from '@/features/exercises';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { forgetRoutine, refreshRoutine } from '@/features/routines/facades/routineQueryKeys';
import { addRoutineItem } from '@/features/routines/useCases/addRoutineItem';
import { deleteRoutine } from '@/features/routines/useCases/deleteRoutine';
import { duplicateRoutine } from '@/features/routines/useCases/duplicateRoutine';
import { removeRoutineItem } from '@/features/routines/useCases/removeRoutineItem';
import { renameRoutine } from '@/features/routines/useCases/renameRoutine';
import { reorderRoutine } from '@/features/routines/useCases/reorderRoutine';
import { setRoutineItem } from '@/features/routines/useCases/setRoutineItem';

/**
 * Every write to a saved routine invalidates rather than patches the cache: the items are replaced
 * or renumbered on disk, and re-reading costs a couple of indexed queries and cannot disagree with
 * the database. None is optimistic: a reorder drawn before it commits could be dragged again
 * against a stale order.
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

/** `routineId` names the routine to refresh; the item is addressed by its own id. */
export function useSetRoutineItem() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: ({
      itemId,
      patch,
    }: {
      readonly routineId: RoutineId;
      readonly itemId: string;
      readonly patch: Partial<ItemTarget>;
    }) => setRoutineItem(itemId, patch),
    onSuccess: (_done, { routineId }) => refreshRoutine(client, routineId),
  });
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
