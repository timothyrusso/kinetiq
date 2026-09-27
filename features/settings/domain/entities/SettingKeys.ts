import type { Settings } from '@/features/settings/domain/schemas/SettingsSchema';

/**
 * The `settings` row that holds each stored preference. One typed key per row rather than a
 * blob: a single malformed row then degrades one preference instead of resetting everything, and
 * a schema migration only has to know about the keys it cares about. `notificationsGranted` is
 * absent: it is a fact about the device, read at launch, not a user preference.
 */
export const SETTING_KEYS = {
  unitSystem: 'settings.units',
  themeMode: 'settings.theme',
  accentColor: 'settings.accentColor',
  language: 'settings.language',
  hapticsEnabled: 'settings.haptics',
  restCountdownHaptics: 'settings.restCountdownHaptics',
  keepScreenAwake: 'settings.keepScreenAwake',
  notificationsEnabled: 'settings.notifications',
  defaultRestSeconds: 'settings.defaultRestSeconds',
  weeklyGoalWorkouts: 'settings.weeklyGoalWorkouts',
  autoStartRest: 'settings.autoStartRest',
  profile: 'settings.profile',
  reminder: 'settings.reminder',
} as const satisfies Partial<Record<keyof Settings, string>>;

/** A preference that has a row of its own. */
export type StoredSetting = keyof typeof SETTING_KEYS;
