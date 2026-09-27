import { Clock, Effect } from 'effect';
import { localId } from '@/features/core/utils';
import { type Exercise, ExerciseSnapshotRepository, snapshotOf } from '@/features/exercises';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import { RoutineNotFound } from '@/features/routines/domain/errors/RoutinesErrors';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

/**
 * Appends `exercise` to routine `routineId` with `target`. The exercise is frozen into a stored
 * snapshot first, which is what lets the routine render with no network from then on; a routine
 * that does not exist fails with `RoutineNotFound` before anything is stored.
 */
export const addRoutineItem = (routineId: RoutineId, exercise: Exercise, target: ItemTarget) =>
  Effect.gen(function* () {
    const repo = yield* RoutineRepository;
    if ((yield* repo.byId(routineId)) === undefined) return yield* new RoutineNotFound({ routineId });
    const capturedAt = yield* Clock.currentTimeMillis;
    yield* (yield* ExerciseSnapshotRepository).upsert(snapshotOf(exercise, capturedAt));
    yield* repo.addItem(routineId, {
      id: localId('rit'),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      ...target,
    });
  });
