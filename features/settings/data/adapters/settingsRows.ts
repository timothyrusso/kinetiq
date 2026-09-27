import { Effect, Either, Schema } from 'effect';
import { DecodeError } from '@/features/core/error';
import { SETTING_KEYS, type StoredSetting } from '@/features/settings/domain/entities/SettingKeys';
import { type Settings, SettingsSchema } from '@/features/settings/domain/schemas/SettingsSchema';

/** A row of the `settings` table. */
const SettingsRow = Schema.Struct({ key: Schema.String, value_json: Schema.String, updated_at: Schema.Number });

const decodeRows = Schema.decodeUnknown(Schema.Array(SettingsRow));
const decodeSettings = Schema.decodeUnknown(SettingsSchema);
const parseValue = Schema.decodeUnknownEither(Schema.parseJson());

const STORED = Object.entries(SETTING_KEYS) as readonly (readonly [StoredSetting, string])[];

/** Every stored setting's row key, in the order the rows are read and written. */
export const STORED_KEYS: readonly string[] = STORED.map(([, key]) => key);

/**
 * The rows of the `settings` table, folded back into `Settings` by key, never by position. A row
 * whose JSON does not parse reads as unset, so its default applies; a row of the wrong shape
 * fails the read with a `DecodeError`.
 */
export const settingsFromRows = (rows: unknown): Effect.Effect<Settings, DecodeError> =>
  Effect.gen(function* () {
    const decoded = yield* decodeRows(rows);
    const byKey = new Map<string, unknown>();
    for (const row of decoded) {
      const value = parseValue(row.value_json);
      if (Either.isRight(value)) byKey.set(row.key, value.right);
    }
    const stored: Partial<Record<StoredSetting, unknown>> = {};
    for (const [name, key] of STORED) {
      if (byKey.has(key)) stored[name] = byKey.get(key);
    }
    return yield* decodeSettings(stored);
  }).pipe(Effect.mapError(cause => new DecodeError({ source: 'settings', cause })));

/** Each stored setting as its row key and JSON text. */
export const settingsToRows = (settings: Settings): readonly (readonly [string, string])[] =>
  STORED.map(([name, key]) => [key, JSON.stringify(settings[name] ?? null)] as const);
