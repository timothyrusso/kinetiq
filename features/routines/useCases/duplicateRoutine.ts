import { Effect } from 'effect';
import { localId } from '@/features/core/utils';
import { RoutineNotFound } from '@/features/routines/domain/errors/RoutinesErrors';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { freeRoutineName } from '@/features/routines/domain/utils/routineNames';

/**
 * A new routine with routine `id`'s items, under ids of their own, called `<name> copy` (with a
 * number when that is taken). The items point at the exercises the original already stored, so
 * the copy opens offline as the original does. Returns the copy.
 */
export const duplicateRoutine = (id: RoutineId) =>
  Effect.gen(function* () {
    const repo = yield* RoutineRepository;
    const routines = yield* repo.list;
    const source = routines.find(routine => routine.id === id);
    if (source === undefined) return yield* new RoutineNotFound({ routineId: id });
    const name = freeRoutineName(
      `${source.name} copy`,
      routines.map(routine => routine.name),
    );
    return yield* repo.save({ name, items: source.items.map(item => ({ ...item, id: localId('rit') })) });
  });
