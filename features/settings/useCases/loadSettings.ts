import { Effect } from 'effect';
import { SettingsRepository } from '@/features/settings/domain/repositories/SettingsRepository';

/** Every stored preference, for the boot step that hydrates the settings store. */
export const loadSettings = Effect.flatMap(SettingsRepository, repository => repository.load);
