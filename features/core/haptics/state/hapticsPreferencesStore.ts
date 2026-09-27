import { createSelectors, createStore } from '@/features/core/state';

/** The two haptics switches in Settings. */
export interface HapticsPreferences {
  readonly enabled: boolean;
  readonly restCountdown: boolean;
}

interface HapticsPreferencesState extends HapticsPreferences {
  readonly setPreferences: (preferences: HapticsPreferences) => void;
}

const hapticsPreferencesStore = createStore<HapticsPreferencesState>(set => ({
  enabled: true,
  restCountdown: true,
  setPreferences: preferences => set(preferences),
}));

/**
 * Whether haptics fire. The settings store owns the switches and mirrors them here through
 * {@link setHapticsPreferences}, so haptics read no feature above them.
 */
export const useHapticsPreferencesStore = createSelectors(hapticsPreferencesStore);

/** Mirrors the user's haptics switches into the haptics module. */
export function setHapticsPreferences(preferences: HapticsPreferences): void {
  const current = hapticsPreferencesStore.getState();
  if (current.enabled === preferences.enabled && current.restCountdown === preferences.restCountdown) return;
  current.setPreferences(preferences);
}
