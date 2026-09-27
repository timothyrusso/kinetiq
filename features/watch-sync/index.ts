import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 4: it mirrors
 * the routines onto the Apple Watch and records the workouts the watch finished, coordinating
 * `routines`, `workouts` and `watch-bridge` without an entity of its own.
 */
export const FEATURE_TIER: FeatureTier = 4;

export { WatchSyncLive } from '@/features/watch-sync/di/layer';
