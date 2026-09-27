import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * Shared test Layers and helpers. Import only from tests: it loads `node:sqlite`, which Metro
 * cannot bundle.
 */
export const FEATURE_TIER: FeatureTier = 0;

export { advanceClock, collectLogs, itEffect, makeNodeSqliteLayer } from '@timothyrusso/effect-core/testing';
export { makeHapticsFake } from '@/features/core/testing/hapticsFake';
export { makeMigratedSqliteLayer } from '@/features/core/testing/sqliteTestLayer';
export { makeTestAppLayer, makeTestRuntime } from '@/features/core/testing/testAppLayer';
export { makeTestWrapper } from '@/features/core/testing/testWrapper';
