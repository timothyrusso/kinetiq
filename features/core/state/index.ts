import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { createSelectors, type WithSelectors } from '@/features/core/state/createSelectors';
export { createStore, resetAllStores } from '@/features/core/state/createStore';
