import bounds from '@/features/watch-bridge/assets/bounds.json';

/**
 * The bounds of a routine item: the routine editor's steppers, the importer and the Apple Watch
 * all enforce them. They live in `bounds.json` because the watch target ships a copy of that file
 * as a bundle resource, and `check:watch` fails if the two drift apart. `notesLength` is the same
 * limit as the item editor's note field; `durationSeconds` bounds a timed set.
 */
export const ITEM_BOUNDS = bounds.itemBounds;

/** Beyond this a file is not a routine collection anyone meant to import. */
export const IMPORT_LIMITS = bounds.importLimits;
