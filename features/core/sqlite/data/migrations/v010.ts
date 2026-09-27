import type { Migration } from '@timothyrusso/effect-core';

/**
 * What the removed demo seed (#40) left behind on installs that had it: its done-marker in
 * app_state, and the `seeded` flag on activities and routines, which nothing reads or
 * writes any more. The seeded rows themselves stay: they are indistinguishable from the
 * user's own history once the flag has gone, and deleting history in a migration is not
 * something to do silently. Plain column drops, as in migration 8: no index or trigger
 * touches either column.
 */
export const v010: Migration = {
  version: 10,
  up: async txn => {
    await txn.execAsync(`
        DELETE FROM app_state WHERE key = 'seed.done';
        ALTER TABLE activities DROP COLUMN seeded;
        ALTER TABLE routines DROP COLUMN seeded;
      `);
  },
};
