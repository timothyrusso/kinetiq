import { setHapticsPreferences } from '@/features/core/haptics';
import { createSelectors, createStore } from '@/features/core/state';
import { setAppearancePreferences } from '@/features/core/theme';
import { setLanguagePreference } from '@/features/core/translations';
import { DEFAULT_SETTINGS, type Settings } from '@/features/settings/domain/schemas/SettingsSchema';
import { normaliseSettings } from '@/features/settings/domain/utils/normaliseSettings';

/** A partial change to the settings. */
export type SettingsPatch = Partial<Settings>;

interface SettingsStoreState {
  readonly settings: Settings;
  /** Counts the user's writes; the autosave persists when it moves. A hydrate does not move it. */
  readonly writes: number;
  readonly hydrate: (stored: unknown) => void;
  readonly update: (patch: SettingsPatch) => void;
}

/**
 * The settings, readable synchronously anywhere: they are read by the theme, the formatters, the
 * workout session, the notification scheduler and the query layer, and a provider would re-render
 * the whole tree on every keystroke in a text field. Writes are optimistic; the autosave Layer
 * persists them behind a debounce.
 */
const settingsStore = createStore<SettingsStoreState>(set => ({
  settings: DEFAULT_SETTINGS,
  writes: 0,
  hydrate: stored => set({ settings: normaliseSettings(stored) }),
  update: patch =>
    set(state => ({
      settings: normaliseSettings({ ...state.settings, ...patch }, state.settings),
      writes: state.writes + 1,
    })),
}));

// NOTE: the core concerns below settings (translations, theme, haptics) keep their own copy of the
// preferences they need, so they depend on nothing above them. Subscribed first, so the copies are
// current before any component's listener runs and a render never sees the two disagree.
settingsStore.subscribe(({ settings }, previous) => {
  if (settings === previous.settings) return;
  setLanguagePreference(settings.language);
  setAppearancePreferences({ themePreference: settings.themeMode, accentColor: settings.accentColor });
  setHapticsPreferences({ enabled: settings.hapticsEnabled, restCountdown: settings.restCountdownHaptics });
});

export const useSettingsStore = createSelectors(settingsStore);

/** The settings now, for code outside React. */
export function getSettings(): Settings {
  return settingsStore.getState().settings;
}

/** Replaces the settings wholesale at boot, without persisting them. */
export function hydrateSettings(stored: unknown): void {
  settingsStore.getState().hydrate(stored);
}

/** Applies `patch` now; the autosave persists it. */
export function updateSettings(patch: SettingsPatch): void {
  settingsStore.getState().update(patch);
}

/** Calls `listener` after every change to the settings. Returns the unsubscribe. */
export function subscribeSettings(listener: () => void): () => void {
  return settingsStore.subscribe(({ settings }, previous) => {
    if (settings !== previous.settings) listener();
  });
}
