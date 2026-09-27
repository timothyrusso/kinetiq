import type { Settings } from '@/features/settings/domain/schemas/SettingsSchema';
import { type SettingsPatch, updateSettings, useSettingsStore } from '@/features/settings/state/settingsStore';

/**
 * Selects a slice of the settings. The selector must return a primitive or a stable reference,
 * because the store compares with `Object.is`: `useSettings(s => s.profile)` for an object (its
 * identity changes only on write), never `useSettings(s => ({ a: s.a, b: s.b }))`, which would
 * re-render forever.
 */
export function useSettings<T>(selector: (settings: Settings) => T): T {
  return useSettingsStore(state => selector(state.settings));
}

/** The settings writer, for handlers. */
export function useSettingsUpdate(): (patch: SettingsPatch) => void {
  return updateSettings;
}
