import type { Migration } from '@timothyrusso/effect-core';

/**
 * Routines lost their description: the note moved onto each exercise, where it is read
 * mid-set. A column drop, not the table copy migration 7 used, because `routine_items`
 * references `routines ON DELETE CASCADE` and dropping the old table would take every
 * routine's exercises with it. Nothing indexes or triggers on `description`, which is the
 * condition `DROP COLUMN` needs.
 */
export const v008: Migration = {
  version: 8,
  up: async txn => {
    await txn.execAsync('ALTER TABLE routines DROP COLUMN description;');
  },
};
