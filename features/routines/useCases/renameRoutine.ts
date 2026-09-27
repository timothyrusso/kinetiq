import { Effect } from 'effect';
import { RoutineNameTaken, RoutineNotFound } from '@/features/routines/domain/errors/RoutinesErrors';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { sameRoutineName } from '@/features/routines/domain/utils/routineNames';

/**
 * Renames routine `id`. The name must not be another routine's (`RoutineNameTaken`); keeping the
 * routine's own name, in any case, is allowed.
 */
export const renameRoutine = (id: RoutineId, name: string) =>
  Effect.gen(function* () {
    const repo = yield* RoutineRepository;
    const routines = yield* repo.list;
    if (!routines.some(routine => routine.id === id)) return yield* new RoutineNotFound({ routineId: id });
    if (routines.some(routine => routine.id !== id && sameRoutineName(routine.name, name))) {
      return yield* new RoutineNameTaken({ name: name.trim() });
    }
    yield* repo.rename(id, name);
  });
