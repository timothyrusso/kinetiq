import { Effect } from 'effect';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

/** Deletes routine `id` and its items; the workouts trained from it stay in history. */
export const deleteRoutine = (id: RoutineId) => Effect.flatMap(RoutineRepository, repo => repo.delete(id));
