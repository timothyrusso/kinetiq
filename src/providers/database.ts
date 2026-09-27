/**
 * The database steps of bootstrap, run through the app runtime.
 *
 * Opening the shared connection comes first, so an unreadable database is still the fatal
 * error it always was. Booting the runtime then builds its `SqliteClient` Layer, which runs the
 * migrations; a failed migration comes back as `migrationError` rather than a fatal error, so
 * the app stays usable on the schema it has, as before.
 */
import { SqlError } from '@/features/core/error';
import { runtime } from '@/features/core/runtime';
import { clearAllUserData as clearAllUserDataEffect } from '@/features/core/sqlite';
import { openDatabase, readSchemaVersion, type DatabaseOpenResult } from '@/persistence/database';
import { notifyRoutinesChanged } from '@/persistence/routineEvents';

/** Opens the database and boots the runtime, which brings the schema to the last version. */
export async function bootDatabase(): Promise<DatabaseOpenResult> {
  const opened = await openDatabase();
  try {
    await runtime.boot();
  } catch (error) {
    if (!(error instanceof SqlError)) throw error;
    return { ...opened, migrationError: error };
  }
  return { ...opened, toVersion: await readSchemaVersion(opened.db) };
}

/**
 * Wipes user data while keeping the schema and the exercise catalog, then tells the routine
 * listeners, which read nothing from the query cache.
 */
export async function clearAllUserData(): Promise<void> {
  await runtime.runPromise(clearAllUserDataEffect);
  notifyRoutinesChanged();
}
