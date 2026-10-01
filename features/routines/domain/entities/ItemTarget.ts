import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * What a caller supplies to put an exercise into a routine: the item's fields that do not come
 * from the exercise itself.
 */
export type ItemTarget = Pick<RoutineItem, 'sets' | 'restSeconds' | 'notes'>;

/**
 * An edit to an item's targets, worked out from the item as it is when the edit is written rather
 * than as it was drawn: two edits made before the screen redraws (two sets typed one after the
 * other, two quick presses) then each build on the other instead of the second undoing the first.
 */
export type ItemChange = (item: ItemTarget) => Partial<ItemTarget>;
