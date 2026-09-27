import { SqliteClient } from '@timothyrusso/effect-core';
import { itEffect, makeNodeSqliteLayer } from '@timothyrusso/effect-core/testing';
import { Effect } from 'effect';
import { migrations } from '@/features/core/sqlite/data/migrations';
import { migrateReporting } from '@/features/core/sqlite/data/sqliteClientLive';

const lastVersion = Math.max(...migrations.map(migration => migration.version));

describe('migrateReporting', () => {
  itEffect(
    'reports the version it found and the last one it reached, with no error',
    Effect.gen(function* () {
      const status = yield* migrateReporting(yield* SqliteClient);

      expect(status).toEqual({ fromVersion: 0, toVersion: lastVersion, migrationError: null });
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'reports a failed step as its SqlError and leaves the database at the step before it',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      const steps = [
        { version: 1, up: 'CREATE TABLE trips (id TEXT PRIMARY KEY);' },
        { version: 2, up: 'ALTER TABLE missing ADD COLUMN name TEXT;' },
      ];

      const status = yield* migrateReporting(db, steps);

      expect(status.migrationError?._tag).toBe('SqlError');
      expect(status.fromVersion).toBe(0);
      expect(status.toVersion).toBe(1);
      expect(yield* Effect.promise(() => db.getAllAsync('SELECT * FROM trips'))).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );
});
