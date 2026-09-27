import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 4: the launch
 * coordinates every feature below it and owns no entity.
 */
export const FEATURE_TIER: FeatureTier = 4;

export { BootstrapLive } from '@/features/bootstrap/di/layer';
