import { Effect, Layer, Schema } from 'effect';
import { DecodeError } from '@/features/core/error';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { AppStateRepository } from '@/features/settings/domain/repositories/AppStateRepository';

const Row = Schema.NullOr(Schema.Struct({ value_json: Schema.String }));

/** The `app_state` table: one JSON value per key. */
export const AppStateRepositoryLive = Layer.effect(
  AppStateRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      get: (key, schema) =>
        trySql(`read ${key}`, () =>
          db.getFirstAsync<unknown>('SELECT value_json FROM app_state WHERE key = ?', [key]),
        ).pipe(
          Effect.flatMap(row =>
            Schema.decodeUnknown(Row)(row).pipe(
              Effect.flatMap(found =>
                found === null
                  ? Effect.succeed(undefined)
                  : Schema.decodeUnknown(Schema.parseJson(schema))(found.value_json),
              ),
              Effect.mapError(cause => new DecodeError({ source: `app_state ${key}`, cause })),
            ),
          ),
        ),
      set: (key, value) =>
        trySql(`write ${key}`, () =>
          db.runAsync(
            `INSERT INTO app_state (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
            [key, JSON.stringify(value ?? null)],
          ),
        ),
    };
  }),
);
