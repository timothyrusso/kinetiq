import type { Migration } from '@timothyrusso/effect-core';

/**
 * Routine items need to survive the source exercise being re-fetched or
 * deleted remotely: denormalise the name onto the item at write time.
 */
export const v003: Migration = {
  version: 3,
  up: async txn => {
    await txn.execAsync(`ALTER TABLE routine_items ADD COLUMN exercise_name TEXT NOT NULL DEFAULT '';`);
    await txn.execAsync(`
        UPDATE routine_items
           SET exercise_name = COALESCE((
                 SELECT e.name FROM exercises e WHERE e.id = routine_items.exercise_id
               ), '');
      `);
    await txn.execAsync(`ALTER TABLE exercises ADD COLUMN thumbnail_url TEXT;`);
  },
};
