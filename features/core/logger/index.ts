import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { LoggerLive } from '@/features/core/logger/di/layer';
export { logBackgroundFailure } from '@/features/core/logger/useCases/logBackgroundFailure';
