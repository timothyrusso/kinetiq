import { Effect, Layer } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { SettingsRepositoryLive } from '@/features/settings/data/repositories/settingsRepositoryLive';
import { SettingsRepository } from '@/features/settings/domain/repositories/SettingsRepository';
import { DEFAULT_SETTINGS, type Settings } from '@/features/settings/domain/schemas/SettingsSchema';

const layer = () => SettingsRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const changed: Settings = {
  ...DEFAULT_SETTINGS,
  unitSystem: 'imperial',
  themeMode: 'dark',
  accentColor: 'ocean',
  language: 'it',
  hapticsEnabled: false,
  restCountdownHaptics: false,
  keepScreenAwake: false,
  notificationsEnabled: false,
  defaultRestSeconds: 120,
  autoStartRest: false,
  weeklyGoalWorkouts: 6,
  profile: { name: 'Ada', heightCm: 170, birthYear: 1990 },
  reminder: { enabled: true, minuteOfDay: 7 * 60 + 30, days: [2, 4] },
};

const rows = Effect.flatMap(SqliteClient, db =>
  Effect.promise(() =>
    db.getAllAsync<{ key: string; value_json: string }>('SELECT key, value_json FROM settings ORDER BY key'),
  ),
);

const insert = (key: string, json: string) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() =>
      db.runAsync('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, 1)', [key, json]),
    ),
  );

describe('SettingsRepositoryLive', () => {
  itEffect(
    'reads back every preference it saved',
    Effect.gen(function* () {
      const repository = yield* SettingsRepository;
      yield* repository.save(changed);
      expect(yield* repository.load).toEqual(changed);
    }),
    layer(),
  );

  itEffect(
    'writes one row per stored preference, never the device permission',
    Effect.gen(function* () {
      const repository = yield* SettingsRepository;
      yield* repository.save({ ...changed, notificationsGranted: true });
      const stored = yield* rows;
      expect(stored).toHaveLength(14);
      expect(stored).toContainEqual({ key: 'settings.units', value_json: '"imperial"' });
      expect(stored).toContainEqual({
        key: 'settings.reminder',
        value_json: '{"enabled":true,"minuteOfDay":450,"days":[2,4]}',
      });
      expect((yield* repository.load).notificationsGranted).toBe(false);
    }),
    layer(),
  );

  itEffect(
    'overwrites on a second save',
    Effect.gen(function* () {
      const repository = yield* SettingsRepository;
      yield* repository.save(changed);
      yield* repository.save({ ...changed, weeklyGoalWorkouts: 2 });
      expect((yield* repository.load).weeklyGoalWorkouts).toBe(2);
      expect(yield* rows).toHaveLength(14);
    }),
    layer(),
  );

  itEffect(
    'reads an empty table as the defaults',
    Effect.gen(function* () {
      expect(yield* (yield* SettingsRepository).load).toEqual(DEFAULT_SETTINGS);
    }),
    layer(),
  );

  itEffect(
    'degrades a corrupt row to its default and clamps an out-of-range one',
    Effect.gen(function* () {
      yield* insert('settings.units', '{not json');
      yield* insert('settings.defaultRestSeconds', '9999');
      yield* insert('settings.theme', '"sepia"');
      yield* insert('settings.profile', '{"name":"  Ada  ","heightCm":"tall"}');
      const loaded = yield* (yield* SettingsRepository).load;
      expect(loaded.unitSystem).toBe('metric');
      expect(loaded.defaultRestSeconds).toBe(600);
      expect(loaded.themeMode).toBe('system');
      expect(loaded.profile).toEqual({ name: 'Ada', heightCm: 178, birthYear: 1994 });
    }),
    layer(),
  );
});
