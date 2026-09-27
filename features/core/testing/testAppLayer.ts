import { makeAppRuntime } from '@timothyrusso/effect-core';
import { collectLogs } from '@timothyrusso/effect-core/testing';
import { Layer, TestContext } from 'effect';
import { AppConfig } from '@/features/core/config';
import { makeHapticsFake } from '@/features/core/testing/hapticsFake';
import { makeMigratedSqliteLayer } from '@/features/core/testing/sqliteTestLayer';

/** The config tests run with: the values `app.json` ships. */
const TEST_CONFIG = { wgerBaseUrl: 'https://wger.de/api/v2/' } as const;

/**
 * What the core provides in tests, in place of `AppLayer`'s core: a migrated in-memory
 * database, a fixed config, a `Logger` that collects, a `Haptics` that records and Effect's
 * `TestClock`. Build one per test: the logs, the haptics and the database are its own.
 */
export const makeTestAppLayer = () => {
  const logs = collectLogs();
  const haptics = makeHapticsFake();
  const layer = Layer.mergeAll(
    logs.layer,
    AppConfig.layerOf(TEST_CONFIG),
    makeMigratedSqliteLayer(),
    haptics.layer,
    TestContext.TestContext,
  );
  return { layer, logs, haptics: haptics.played };
};

/** What {@link makeTestAppLayer} provides: the services a feature Layer under test may need. */
export type CoreTestServices = Layer.Layer.Success<ReturnType<typeof makeTestAppLayer>['layer']>;

/**
 * A runtime for facade and hook tests: the given feature Layers over {@link makeTestAppLayer},
 * with the logs and haptics it records. Dispose it at the end of the test.
 */
export const makeTestRuntime = <R, E>(features: Layer.Layer<R, E, CoreTestServices>) => {
  const { layer, logs, haptics } = makeTestAppLayer();
  return { runtime: makeAppRuntime(features.pipe(Layer.provideMerge(layer))), logs, haptics };
};
