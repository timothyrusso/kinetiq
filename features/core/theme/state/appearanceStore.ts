import { createSelectors, createStore } from '@/features/core/state';
import type { AppearancePreferences } from '@/features/core/theme/appearance';
import { applyNativeColorScheme } from '@/features/core/theme/nativeAppearance';

interface AppearanceState extends AppearancePreferences {
  readonly setAppearance: (preferences: AppearancePreferences) => void;
}

const appearanceStore = createStore<AppearanceState>(set => ({
  themePreference: 'system',
  accentColor: 'kinetiq',
  setAppearance: preferences => set(preferences),
}));

/**
 * The appearance the theme is built from. The settings store owns the preferences and mirrors
 * them here through {@link setAppearancePreferences}, so the theme reads no feature above it.
 */
export const useAppearanceStore = createSelectors(appearanceStore);

/** Mirrors the user's appearance preferences into the theme. */
export function setAppearancePreferences(preferences: AppearancePreferences): void {
  const current = appearanceStore.getState();
  if (current.themePreference === preferences.themePreference && current.accentColor === preferences.accentColor) {
    return;
  }
  if (current.themePreference !== preferences.themePreference) {
    applyNativeColorScheme(preferences.themePreference);
  }
  current.setAppearance(preferences);
}
