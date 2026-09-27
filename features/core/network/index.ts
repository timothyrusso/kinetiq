import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export {
  getNetworkStatus,
  type NetworkStatus,
  startNetworkStatus,
  subscribeNetworkStatus,
} from '@/features/core/network/networkStatus';
