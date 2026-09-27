import { Context, type Effect, type Schema } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';

/**
 * App bookkeeping in the `app_state` table: one JSON value per key, for facts the app records
 * about itself rather than preferences the user chose.
 */
export class AppStateRepository extends Context.Tag('settings/AppStateRepository')<
  AppStateRepository,
  {
    /** The value under `key` decoded with `schema`, or `undefined` when there is none. */
    readonly get: <A, I>(
      key: string,
      schema: Schema.Schema<A, I>,
    ) => Effect.Effect<A | undefined, SqlError | DecodeError>;
    /** Stores `value` under `key` as JSON, replacing what was there. */
    readonly set: (key: string, value: unknown) => Effect.Effect<void, SqlError>;
  }
>() {}
