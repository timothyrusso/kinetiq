import { Effect } from 'effect';
import { RoutineNotFound } from '@/features/routines/domain/errors/RoutinesErrors';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { orderedItemIds } from '@/features/routines/domain/utils/routineOrder';

/**
 * Puts routine `id`'s items in the order of `orderedIds`, the whole list the screen was showing.
 * Ids the routine does not have are ignored and items the list leaves out follow in their old
 * order, so a reorder raced by another write can move rows but never lose one.
 */
export const reorderRoutine = (id: RoutineId, orderedIds: readonly string[]) =>
  Effect.gen(function* () {
    const repo = yield* RoutineRepository;
    const routine = yield* repo.byId(id);
    if (routine === undefined) return yield* new RoutineNotFound({ routineId: id });
    yield* repo.reorder(id, orderedItemIds(routine.items, orderedIds));
  });
