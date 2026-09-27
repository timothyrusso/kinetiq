import { runMigrations, SqliteClient } from '@timothyrusso/effect-core';
import { makeNodeSqliteLayer } from '@timothyrusso/effect-core/testing';
import { Effect, Layer } from 'effect';
import { migrations } from '@/features/core/sqlite';

/** A fresh in-memory `node:sqlite` database at the app's last schema version. */
export const makeMigratedSqliteLayer = () =>
  Layer.effectDiscard(Effect.flatMap(SqliteClient, db => runMigrations(db, migrations))).pipe(
    Layer.provideMerge(makeNodeSqliteLayer()),
  );
