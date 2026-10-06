import type { RoutineItem, RoutineSet, TrackingType } from '@/features/routines/domain/schemas/RoutineSchema';

/**
 * What a caller supplies to put an exercise into a routine: the item's fields that do not come
 * from the exercise itself, its tracking type with sets of that type.
 */
export type ItemTarget = TargetOf<RoutineItem>;

/** `Item` without what comes from the exercise, member by member of the union. */
type TargetOf<Item> = Item extends RoutineItem ? Omit<Item, 'id' | 'exerciseId' | 'exerciseName'> : never;

/**
 * The targets an edit changes, each absent one left as it is; a `notes` of null clears the note.
 * A tracking type comes with the sets it gives the item (see `itemAs`): an item keeps only the
 * sets of its own type, so a type given alone would leave it with none.
 */
export interface ItemPatch {
  readonly trackingType?: TrackingType;
  readonly sets?: readonly RoutineSet[];
  readonly restSeconds?: number;
  readonly notes?: string | null;
}

/**
 * An edit to an item's targets, worked out from the item as it is when the edit is written rather
 * than as it was drawn: two edits made before the screen redraws (two sets typed one after the
 * other, two quick presses) then each build on the other instead of the second undoing the first.
 */
export type ItemChange = (item: RoutineItem) => ItemPatch;
