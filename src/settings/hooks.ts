import { useSyncExternalStore } from 'react';
import { getSettings, subscribeSettings, updateSettings, type SettingsPatch } from './store';
import type { SettingsState } from './types';

/**
 * Selects a slice of settings. The selector must return a primitive or a stable
 * reference, because `useSyncExternalStore` compares with `Object.is`: use
 * `useSettings(s => s.profile)` for an object (identity only changes on write),
 * never `useSettings(s => ({a: s.a, b: s.b}))`, which would re-render forever.
 */
export function useSettings<T>(selector: (settings: SettingsState) => T): T {
  const read = () => selector(getSettings());
  return useSyncExternalStore(subscribeSettings, read, read);
}

export function useSettingsUpdate(): (patch: SettingsPatch) => void {
  return updateSettings;
}
