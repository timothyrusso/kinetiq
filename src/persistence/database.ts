/**
 * The legacy open of the app database, for the launch's diagnostics and the watch paths.
 *
 * The connection, the schema and its migrations live in `features/core/sqlite`; every repository
 * is a Layer on the same shared connection `SqliteClient` uses. This goes away with bootstrap and
 * watch-sync (#54).
 */
import type * as SQLite from 'expo-sqlite';
import { openAppDatabase } from '@/features/core/sqlite';

export type DatabaseOpenResult = {
  db: SQLite.SQLiteDatabase;
  fromVersion: number;
  toVersion: number;
  /** Set when migrations failed; the caller decides how to degrade. */
  migrationError?: unknown;
};

/** The schema version the database is at now. */
export async function readSchemaVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Opens the shared connection, once. It does not migrate: the runtime's `SqliteClient` Layer
 * does, when bootstrap boots it.
 */
export async function openDatabase(): Promise<DatabaseOpenResult> {
  const db = await openAppDatabase();
  const version = await readSchemaVersion(db);
  return { db, fromVersion: version, toVersion: version };
}

