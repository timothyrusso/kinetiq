import { Logger } from '@timothyrusso/effect-core';
import { Effect, Layer, Queue, Stream } from 'effect';
import { SettingsRepository } from '@/features/settings/domain/repositories/SettingsRepository';
import type { Settings } from '@/features/settings/domain/schemas/SettingsSchema';
import { useSettingsStore } from '@/features/settings/state/settingsStore';

/** How long the settings must stay still before they are written: a run of toggles costs one write. */
const PERSIST_DEBOUNCE = '250 millis';

/**
 * Persists every user write to the settings store, debounced, for as long as the runtime lives.
 *
 * A failed write keeps the values in memory for this run and is logged here, because this fiber
 * has no caller to hand the failure to: reverting the screen to values the user never chose
 * would be worse than a preference that reverts on the next launch.
 */
export const SettingsAutosaveLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const repository = yield* SettingsRepository;
    const logger = yield* Logger;
    const writes = yield* Queue.unbounded<Settings>();
    const unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (state.writes !== previous.writes) Queue.unsafeOffer(writes, state.settings);
    });
    yield* Effect.addFinalizer(() => Effect.sync(unsubscribe));
    yield* Stream.fromQueue(writes).pipe(
      Stream.debounce(PERSIST_DEBOUNCE),
      Stream.runForEach(settings =>
        repository
          .save(settings)
          .pipe(Effect.catchTag('SqlError', error => logger.warn('settings could not be persisted', { error }))),
      ),
      Effect.forkScoped,
    );
  }),
);
