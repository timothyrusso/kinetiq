import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 4: the tabs
 * and screens that put `workouts` and `routines` together, which neither may do for the other.
 */
export const FEATURE_TIER: FeatureTier = 4;

export { HomeLive } from '@/features/home/di/layer';
