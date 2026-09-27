import { Layer } from 'effect';
import { AppStateRepositoryLive } from '@/features/settings/data/repositories/appStateRepositoryLive';
import { SettingsRepositoryLive } from '@/features/settings/data/repositories/settingsRepositoryLive';
import { SettingsAutosaveLive } from '@/features/settings/data/services/settingsAutosaveLive';

/** Every Layer `settings` provides: the two repositories, and the autosave of the settings store. */
export const SettingsLive = Layer.mergeAll(
  SettingsRepositoryLive,
  AppStateRepositoryLive,
  SettingsAutosaveLive.pipe(Layer.provide(SettingsRepositoryLive)),
);
