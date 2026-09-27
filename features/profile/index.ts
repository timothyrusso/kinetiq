import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * @public Read by the architecture rules, which build the tier graph from it. Tier 4: the Profile
 * tab and its settings screens read the settings, the workouts' progress and the routines' count
 * without an entity of their own.
 */
export const FEATURE_TIER: FeatureTier = 4;
