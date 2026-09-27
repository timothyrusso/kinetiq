/**
 * The legacy repositories' handle on the app database.
 *
 * The connection, the schema and its migrations live in `features/core/sqlite`; this module
 * only keeps the synchronous `getDatabase()` the repositories below still call, on the same
 * shared connection `SqliteClient` uses. It goes away as each repository becomes a Layer.
 */
import type * as SQLite from 'expo-sqlite';
import { openAppDatabase } from '@/features/core/sqlite';

let database: SQLite.SQLiteDatabase | null = null;

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
 * Opens the shared connection, once, and makes it available to `getDatabase()`. It does not
 * migrate: the runtime's `SqliteClient` Layer does, when bootstrap boots it.
 */
export async function openDatabase(): Promise<DatabaseOpenResult> {
  const db = await openAppDatabase();
  database = db;
  const version = await readSchemaVersion(db);
  return { db, fromVersion: version, toVersion: version };
}

/**
 * Runs `task` in one transaction on the main connection: every repository call inside it is
 * part of the same all-or-nothing write, because repositories use this connection too.
 */
export async function withTransaction(task: () => Promise<void>): Promise<void> {
  await getDatabase().withTransactionAsync(task);
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!database) throw new Error('Database accessed before openDatabase() resolved');
  return database;
}
