import { Effect, Layer } from 'effect';
import { SqlError } from '@/features/core/error';
import { SchemaStatus, SqliteClient } from '@/features/core/sqlite';

/** Stores one routine, so a test can tell whether an erase ran. */
export const seedRoutine = Effect.flatMap(SqliteClient, db =>
  Effect.promise(() =>
    db.execAsync("INSERT INTO routines (id, name, created_at, updated_at) VALUES ('r1', 'Push day', 1, 1);"),
  ),
);

/** How many routines are stored. */
export const routineCount = Effect.flatMap(SqliteClient, db =>
  Effect.promise(() => db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM routines')),
).pipe(Effect.map(row => row?.n ?? 0));

/** A launch whose migration to version 10 failed: the first thing the bootstrap reads. */
export const FailedMigrationLayer = Layer.succeed(SchemaStatus, {
  current: Effect.succeed({
    fromVersion: 9,
    toVersion: 9,
    migrationError: new SqlError({ message: 'migration 10 failed' }),
  }),
  remigrate: Effect.die(new Error('not used by the launch gate')),
});

/** A launch that died before it read anything: a defect, which reaches the gate as `UnexpectedError`. */
export const DefectLayer = Layer.succeed(SchemaStatus, {
  current: Effect.die(new Error('native module missing')),
  remigrate: Effect.die(new Error('not used by the launch gate')),
});

/** Nothing above the core test services: the reset needs only the database and its schema status. */
export const CoreOnly = Layer.empty;
