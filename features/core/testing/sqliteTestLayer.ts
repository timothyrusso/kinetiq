import { runMigrations, SqliteClient } from '@timothyrusso/effect-core';
import { makeNodeSqliteLayer } from '@timothyrusso/effect-core/testing';
import { Effect, Layer } from 'effect';
import { migrations, SchemaStatus } from '@/features/core/sqlite';

/**
 * A fresh in-memory `node:sqlite` database at the app's last schema version, with the
 * `SchemaStatus` of a launch whose migrations all ran.
 */
export const makeMigratedSqliteLayer = () =>
  Layer.effect(
    SchemaStatus,
    Effect.flatMap(SqliteClient, db => runMigrations(db, migrations)).pipe(
      Effect.map(report => SchemaStatus.of({ fromVersion: report.from, toVersion: report.to, migrationError: null })),
    ),
  ).pipe(Layer.provideMerge(makeNodeSqliteLayer()));
