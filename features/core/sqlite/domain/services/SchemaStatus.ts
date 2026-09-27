import { Context } from 'effect';
import type { SqlError } from '@/features/core/error';

/**
 * What the launch did to the schema: the version it found and the one it reached, and the failed
 * step's `SqlError` when a migration failed. The connection stays usable on the schema it has,
 * so the launch can show the failure and the erase path still works.
 */
export class SchemaStatus extends Context.Tag('core/sqlite/SchemaStatus')<
  SchemaStatus,
  {
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly migrationError: SqlError | null;
  }
>() {}
