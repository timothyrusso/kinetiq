import type { Migration } from '@timothyrusso/effect-core';

/**
 * The em dash is banned in this codebase (see CLAUDE.md), and it had been sitting inside
 * DATA rather than only in source: three seeded routine names carried it, so it rendered
 * on the Workout tab, in the workout pill, and in every history row derived from them.
 * Changing the seed file only fixes a fresh install; anyone who already has these rows
 * keeps them, so the character has to be migrated out of the stored values too.
 *
 * Scoped to the separator form (space, dash, space) rather than every occurrence, and only
 * in rows the seed created. A user who typed an em dash into their own routine name is
 * entitled to keep it; this is undoing something the app shipped, not policing input.
 */
export const v005: Migration = {
  version: 5,
  up: async txn => {
    await txn.execAsync(`
        UPDATE routines
           SET name = REPLACE(name, ' \u2014 ', ' \u00b7 '),
               description = REPLACE(COALESCE(description, ''), ' \u2014 ', ' \u00b7 ')
         WHERE seeded = 1
           AND (name LIKE '% \u2014 %' OR COALESCE(description, '') LIKE '% \u2014 %');
      `);
    await txn.execAsync(`
        UPDATE activities
           SET title = REPLACE(title, ' \u2014 ', ' \u00b7 ')
         WHERE title LIKE '% \u2014 %';
      `);
  },
};
