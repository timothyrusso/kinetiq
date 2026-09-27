import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { useEffectMutation, useEffectQuery } from '@timothyrusso/effect-core/react';
export { getQueryClient, installQueryAdapters } from '@/features/core/query/queryClient';
