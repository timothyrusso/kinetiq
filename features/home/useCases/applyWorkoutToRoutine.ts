import { Effect } from 'effect';
import { localId } from '@/features/core/utils';
import { routineItemsAfterWorkout } from '@/features/home/useCases/routineItemsAfterWorkout';
import { RoutineId, RoutineRepository } from '@/features/routines';
import type { RoutineUpdate } from '@/features/workouts';

/**
 * Writes a finished workout back into the routine it started from, as it is now: a routine
 * deleted meanwhile changes nothing, and one the workout leaves as it was is not written, so it
 * does not move to the top of the list for nothing. A routine is never written back empty: a
 * workout whose routine exercises were all removed, with nothing done in their place, leaves it
 * as it was.
 */
export const applyWorkoutToRoutine = (update: RoutineUpdate) =>
  Effect.gen(function* () {
    const routines = yield* RoutineRepository;
    const id = RoutineId.make(update.routineId);
    const routine = yield* routines.byId(id);
    if (routine === undefined) return;
    const items = routineItemsAfterWorkout(routine.items, update, () => localId('rit'));
    if (items.length === 0 || JSON.stringify(items) === JSON.stringify(routine.items)) return;
    yield* routines.replaceItems(id, items);
  });
