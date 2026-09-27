import { Effect, Layer } from 'effect';
import { itEffect } from '@/features/core/testing';
import { SettingsRepository } from '@/features/settings/domain/repositories/SettingsRepository';
import { DEFAULT_SETTINGS } from '@/features/settings/domain/schemas/SettingsSchema';
import { loadSettings } from '@/features/settings/useCases/loadSettings';

const stored = { ...DEFAULT_SETTINGS, unitSystem: 'imperial' as const };

describe('loadSettings', () => {
  itEffect(
    'reads the stored preferences through the repository',
    Effect.gen(function* () {
      expect(yield* loadSettings).toEqual(stored);
    }),
    Layer.succeed(SettingsRepository, { load: Effect.succeed(stored), save: () => Effect.void }),
  );
});
