import type { Migration } from '@timothyrusso/effect-core';

/**
 * Migration 5 cleaned `routines` and `activities` and missed `sessions.routine_name`,
 * which is where a workout in progress keeps the label it will write into history. So a
 * session that had been paused since before the rename finished afterwards and put the old
 * name straight back into a brand new activity row, one migration too late to be caught.
 *
 * The lesson is worth the comment: a denormalised copy has to be found everywhere it was
 * copied TO, not only where it was copied from. `routine_items.exercise_name` is the same
 * pattern and is covered by the seed rename, since those names never carried the character.
 *
 * `activities` is swept again rather than trusting 5 to have finished the job, because rows
 * created between the two migrations carry the old value by construction.
 */
export const v006: Migration = {
  version: 6,
  up: async txn => {
    await txn.execAsync(`
        UPDATE sessions
           SET routine_name = REPLACE(routine_name, ' \u2014 ', ' \u00b7 ')
         WHERE routine_name LIKE '% \u2014 %';
      `);
    await txn.execAsync(`
        UPDATE activities
           SET title = REPLACE(title, ' \u2014 ', ' \u00b7 ')
         WHERE title LIKE '% \u2014 %';
      `);
  },
};
