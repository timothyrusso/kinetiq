import type { SQLiteDatabase } from 'expo-sqlite';

/** The file the app's data lives in. */
const DATABASE_NAME = 'kinetiq.db';

let opening: Promise<SQLiteDatabase> | null = null;

/**
 * Opens the app database once, in WAL mode with foreign keys on. Every caller shares the one
 * connection, so the legacy repositories and `SqliteClient` read and write the same database.
 * The driver is loaded on the first open, so importing `core/sqlite` (as the jest tests do, for
 * its migrations) never loads the native module.
 */
export function openAppDatabase(): Promise<SQLiteDatabase> {
  opening ??= (async () => {
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return db;
  })();
  return opening;
}
