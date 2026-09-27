import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 1;

export { SettingsLive } from '@/features/settings/di/layer';
/** The stored preferences, for the launch step that hydrates the settings store. */
export { SettingsRepository } from '@/features/settings/domain/repositories/SettingsRepository';
export {
  DEFAULT_SETTINGS,
  type Profile,
  type ReminderSettings,
  type ThemeMode,
} from '@/features/settings/domain/schemas/SettingsSchema';
export { useSettings, useSettingsUpdate } from '@/features/settings/facades/useSettings';
export {
  getSettings,
  hydrateSettings,
  subscribeSettings,
  updateSettings,
} from '@/features/settings/state/settingsStore';
