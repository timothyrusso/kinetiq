import { Effect } from 'effect';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';

/** Every routine, most recently changed first. */
export const listRoutines = Effect.flatMap(RoutineRepository, repo => repo.list);
