import { withSqlite } from '@timothyrusso/effect-core';

/**
 * The tables that hold the user's own data. The `catalog_*` tables are deliberately absent: the
 * catalog is reference data, and erasing it would leave the exercise picker empty until the next
 * download.
 */
const USER_TABLES = [
  'routine_item_sets',
  'routine_items',
  'routines',
  'activities',
  'sessions',
  'records',
  'exercises',
  'settings',
  'app_state',
] as const;

/** Wipes the user's data in one transaction, keeping the schema and the exercise catalog. */
export const clearAllUserData = withSqlite('clear all user data', db =>
  db.withTransactionAsync(async () => {
    for (const table of USER_TABLES) {
      await db.execAsync(`DELETE FROM ${table};`);
    }
  }),
);
