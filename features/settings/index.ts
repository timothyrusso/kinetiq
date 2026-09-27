import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 1;

export { SettingsLive } from '@/features/settings/di/layer';
export {
  DEFAULT_SETTINGS,
  type Profile,
  type ReminderSettings,
  type Settings,
  type ThemeMode,
} from '@/features/settings/domain/schemas/SettingsSchema';
export { useSettings, useSettingsUpdate } from '@/features/settings/facades/useSettings';
export {
  getSettings,
  hydrateSettings,
  subscribeSettings,
  updateSettings,
} from '@/features/settings/state/settingsStore';
/** The boot step that reads the stored preferences; `hydrateSettings` puts them in the store. */
export { loadSettings } from '@/features/settings/useCases/loadSettings';
