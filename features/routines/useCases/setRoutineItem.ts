import { Effect } from 'effect';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';

/** Changes the targets in `patch` on item `itemId`; a `notes` of null clears the note. */
export const setRoutineItem = (itemId: string, patch: Partial<ItemTarget>) =>
  Effect.flatMap(RoutineRepository, repo => repo.setItem(itemId, patch));
