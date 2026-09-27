import { NoopLogger } from '@timothyrusso/effect-core';
import { advanceClock } from '@timothyrusso/effect-core/testing';
import { Effect, Layer } from 'effect';
import { SqlError } from '@/features/core/error';
import { itEffect } from '@/features/core/testing';
import { SettingsAutosaveLive } from '@/features/settings/data/services/settingsAutosaveLive';
import { SettingsRepository } from '@/features/settings/domain/repositories/SettingsRepository';
import { DEFAULT_SETTINGS, type Settings } from '@/features/settings/domain/schemas/SettingsSchema';
import { getSettings, hydrateSettings, updateSettings } from '@/features/settings/state/settingsStore';

/** A repository that records every save, and fails the ones `failing` says to. */
const makeRepositoryFake = (failing: (settings: Settings) => boolean = () => false) => {
  const saved: Settings[] = [];
  const layer = Layer.succeed(SettingsRepository, {
    load: Effect.succeed(DEFAULT_SETTINGS),
    save: settings =>
      failing(settings)
        ? Effect.fail(new SqlError({ message: 'disk full' }))
        : Effect.sync(() => void saved.push(settings)),
  });
  return { saved: saved as readonly Settings[], layer };
};

const autosave = (repository: ReturnType<typeof makeRepositoryFake>) =>
  SettingsAutosaveLive.pipe(Layer.provide(Layer.merge(repository.layer, NoopLogger)));

beforeEach(() => hydrateSettings({}));

describe('SettingsAutosaveLive', () => {
  const quiet = makeRepositoryFake();
  itEffect(
    'writes once, 250 ms after the last of a run of changes, with the latest values',
    Effect.gen(function* () {
      updateSettings({ unitSystem: 'imperial' });
      yield* advanceClock('200 millis');
      updateSettings({ weeklyGoalWorkouts: 6 });
      yield* advanceClock('249 millis');
      expect(quiet.saved).toHaveLength(0);
      yield* advanceClock('1 millis');
      expect(quiet.saved).toEqual([getSettings()]);
      expect(quiet.saved[0]).toMatchObject({ unitSystem: 'imperial', weeklyGoalWorkouts: 6 });
    }),
    autosave(quiet),
  );

  const hydrated = makeRepositoryFake();
  itEffect(
    'does not write what a hydrate put in the store',
    Effect.gen(function* () {
      hydrateSettings({ unitSystem: 'imperial' });
      yield* advanceClock('1 second');
      expect(hydrated.saved).toHaveLength(0);
      expect(getSettings().unitSystem).toBe('imperial');
    }),
    autosave(hydrated),
  );

  const flaky = makeRepositoryFake(settings => settings.weeklyGoalWorkouts === 2);
  itEffect(
    'keeps the values in memory when a write fails, and still writes the next change',
    Effect.gen(function* () {
      updateSettings({ weeklyGoalWorkouts: 2 });
      yield* advanceClock('250 millis');
      expect(getSettings().weeklyGoalWorkouts).toBe(2);
      updateSettings({ weeklyGoalWorkouts: 3 });
      yield* advanceClock('250 millis');
      expect(flaky.saved.map(settings => settings.weeklyGoalWorkouts)).toEqual([3]);
    }),
    autosave(flaky),
  );
});
