import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * The composition root: Tier 5, so it may import every feature and no feature can import it.
 * Only `app/_layout.tsx` and the bootstrap import it.
 */
export const FEATURE_TIER: FeatureTier = 5;

export { AppLayer, type AppServices, runtime } from '@/features/core/runtime/runtime';
