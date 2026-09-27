import type { Migration } from '@timothyrusso/effect-core';

/**
 * Route polylines were stored as raw GPS samples. Storing a decimated copy
 * keeps map rendering and JSON parsing cheap on long recordings.
 */
export const v002: Migration = {
  version: 2,
  up: async txn => {
    await txn.execAsync(`ALTER TABLE activities ADD COLUMN route_simplified_json TEXT;`);
    await txn.execAsync(`ALTER TABLE activities ADD COLUMN cache_version INTEGER NOT NULL DEFAULT 1;`);
  },
};
