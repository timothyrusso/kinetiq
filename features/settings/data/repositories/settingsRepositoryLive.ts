import { Clock, Effect, Layer } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { STORED_KEYS, settingsFromRows, settingsToRows } from '@/features/settings/data/adapters/settingsRows';
import { SettingsRepository } from '@/features/settings/domain/repositories/SettingsRepository';

const UPSERT = `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
                                    updated_at = excluded.updated_at`;

const SELECT_ALL = `SELECT key, value_json, updated_at FROM settings
     WHERE key IN (${STORED_KEYS.map(() => '?').join(', ')})`;

/** The preferences in the app database, one row per stored setting. */
export const SettingsRepositoryLive = Layer.effect(
  SettingsRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      load: trySql('read the settings', () => db.getAllAsync<unknown>(SELECT_ALL, [...STORED_KEYS])).pipe(
        Effect.flatMap(settingsFromRows),
      ),
      save: settings =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* Effect.forEach(
            settingsToRows(settings),
            ([key, json]) => trySql(`write ${key}`, () => db.runAsync(UPSERT, [key, json, now])),
            { concurrency: 'unbounded', discard: true },
          );
        }),
    };
  }),
);
