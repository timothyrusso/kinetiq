import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { Settings } from '@/features/settings/domain/schemas/SettingsSchema';

/** The user's preferences in the `settings` table. */
export class SettingsRepository extends Context.Tag('settings/SettingsRepository')<
  SettingsRepository,
  {
    /**
     * Every stored preference in one read, decoded: a missing or unreadable row reads as its
     * default. `notificationsGranted` is always its default; the device owns it.
     */
    readonly load: Effect.Effect<Settings, SqlError | DecodeError>;
    /** Writes every stored preference. `notificationsGranted` is never written. */
    readonly save: (settings: Settings) => Effect.Effect<void, SqlError>;
  }
>() {}
