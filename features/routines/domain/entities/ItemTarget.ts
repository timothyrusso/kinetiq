import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * What a caller supplies to put an exercise into a routine: the item's fields that do not come
 * from the exercise itself.
 */
export type ItemTarget = Pick<RoutineItem, 'sets' | 'reps' | 'weightKg' | 'restSeconds' | 'notes'>;
