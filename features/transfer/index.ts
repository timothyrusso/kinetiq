import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 4: exports read
 * the workouts and the routines, imports write routines through `routines` and `exercises`.
 */
export const FEATURE_TIER: FeatureTier = 4;

export { TransferLive } from '@/features/transfer/di/layer';
