import type { Migration } from '@timothyrusso/effect-core';

/**
 * `settings.showKmSplits` was the key name left behind by a cut feature and had
 * been storing the pace-vs-speed choice all along. Renaming a settings row is
 * a data move, not a schema change: `INSERT … ON CONFLICT` would happily
 * create the new row and leave the old one stranded, so the user's preference
 * would silently reset to pace on next launch. Move it first, keep the
 * timestamp, and drop the old row only once the value has landed. `OR IGNORE`
 * means an install that already wrote under the new key keeps what it wrote,
 * which can happen if a build from this branch ran before the migration did.
 */
export const v004: Migration = {
  version: 4,
  up: async txn => {
    await txn.execAsync(`
        INSERT OR IGNORE INTO settings (key, value_json, updated_at)
             SELECT 'settings.showSpeedInsteadOfPace', value_json, updated_at
               FROM settings
              WHERE key = 'settings.showKmSplits';
      `);
    await txn.execAsync(`
        DELETE FROM settings WHERE key = 'settings.showKmSplits';
      `);
  },
};
