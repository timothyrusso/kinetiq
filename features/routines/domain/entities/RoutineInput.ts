import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * A routine to write: a new one when `id` is absent, otherwise the replacement of the stored
 * routine's name and items. The items' ids are written as given.
 */
export interface RoutineInput {
  readonly id?: RoutineId;
  readonly name: string;
  readonly items: readonly RoutineItem[];
}
