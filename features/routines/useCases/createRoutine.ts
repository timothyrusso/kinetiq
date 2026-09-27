import { Effect } from 'effect';
import { type ExerciseSnapshot, ExerciseSnapshotRepository } from '@/features/exercises';
import { RoutineNameTaken } from '@/features/routines/domain/errors/RoutinesErrors';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { derivedRoutineName, freeRoutineName, sameRoutineName } from '@/features/routines/domain/utils/routineNames';

/** A routine the builder assembled, and the snapshots of the exercises it picked for it. */
export interface NewRoutine {
  /** What the user typed; blank when they named nothing. */
  readonly name: string;
  readonly items: readonly RoutineItem[];
  readonly snapshots: readonly ExerciseSnapshot[];
}

/**
 * Saves a new routine. A typed name must be free: another routine with the same name fails with
 * `RoutineNameTaken` and nothing is written. An unnamed routine is named after its exercises, with
 * a number when that name is taken. The snapshots are stored first, so no item ever points at an
 * exercise the device does not have.
 */
export const createRoutine = (input: NewRoutine) =>
  Effect.gen(function* () {
    const repo = yield* RoutineRepository;
    const stored = yield* ExerciseSnapshotRepository;
    const taken = (yield* repo.list).map(routine => routine.name);
    const typed = input.name.trim();
    if (typed.length > 0 && taken.some(name => sameRoutineName(name, typed))) {
      return yield* new RoutineNameTaken({ name: typed });
    }
    const name = typed.length > 0 ? typed : freeRoutineName(derivedRoutineName(input.items), taken);

    for (const snapshot of input.snapshots) yield* stored.upsert(snapshot);

    const names = new Map(input.snapshots.map(snapshot => [snapshot.exerciseId, snapshot.name]));
    const items = input.items.map(item =>
      item.exerciseName.trim().length > 0 ? item : { ...item, exerciseName: names.get(item.exerciseId) ?? '' },
    );
    return yield* repo.save({ name, items });
  });
