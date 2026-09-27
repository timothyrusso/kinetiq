import { Context, type Effect } from 'effect';
import type { SqlError } from '@/features/core/error';

/**
 * What a migration run did to the schema: the version it found and the one it reached, and the
 * failed step's `SqlError` when a migration failed.
 */
export interface SchemaReport {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrationError: SqlError | null;
}

/**
 * The schema as this launch left it. The connection stays usable on the schema it has after a
 * failed migration, so the launch can show the failure, the erase path still works, and an erase
 * can run the migrations again over data that no longer blocks them.
 */
export class SchemaStatus extends Context.Tag('core/sqlite/SchemaStatus')<
  SchemaStatus,
  {
    /** The last migration run: the launch's, or the one after a reset. */
    readonly current: Effect.Effect<SchemaReport>;
    /** Runs the migrations again over the same connection; its report becomes `current`. */
    readonly remigrate: Effect.Effect<SchemaReport, SqlError>;
  }
>() {}
