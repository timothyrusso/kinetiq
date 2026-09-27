import { Schema } from 'effect';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

const isRoutineId = Schema.is(RoutineId);

/** A route parameter as a routine id, or null when it is missing or empty. */
export function routineIdOf(raw: unknown): RoutineId | null {
  return isRoutineId(raw) ? raw : null;
}
