import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 0;

export { BackgroundSync } from '@/features/core/lifecycle/domain/services/BackgroundSync';
