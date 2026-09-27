import { Effect } from 'effect';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

/** Removes item `itemId` from routine `routineId`. The exercise's stored snapshot stays. */
export const removeRoutineItem = (routineId: RoutineId, itemId: string) =>
  Effect.flatMap(RoutineRepository, repo => repo.removeItem(routineId, itemId));
