import { Effect } from 'effect';
import { type ExerciseSnapshot, ExerciseSnapshotRepository } from '@/features/exercises';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { Routine } from '@/features/routines/domain/schemas/RoutineSchema';

/** A routine and the stored snapshots of the exercises it names, by exercise id. */
interface RoutineDetail {
  readonly routine: Routine;
  readonly snapshots: ReadonlyMap<string, ExerciseSnapshot>;
}

/**
 * The routine `id` with its exercises' stored copies, or null when there is no such routine. The
 * two are read together because a routine screen always draws both: an item without its snapshot
 * has no picture and no muscle group.
 */
export const getRoutineDetail = (id: RoutineId) =>
  Effect.gen(function* () {
    const routine = yield* (yield* RoutineRepository).byId(id);
    if (routine === undefined) return null;
    const exerciseIds = [...new Set(routine.items.map(item => item.exerciseId))];
    const snapshots = yield* (yield* ExerciseSnapshotRepository).byIds(exerciseIds);
    const detail: RoutineDetail = { routine, snapshots };
    return detail;
  });
