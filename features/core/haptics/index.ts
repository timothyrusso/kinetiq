import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { HapticsLive } from '@/features/core/haptics/di/layer';
export type { HapticPattern } from '@/features/core/haptics/domain/entities/HapticPattern';
export { Haptics } from '@/features/core/haptics/domain/services/Haptics';
export { haptics, useHaptics } from '@/features/core/haptics/haptics';
export { type HapticsPreferences, setHapticsPreferences } from '@/features/core/haptics/state/hapticsPreferencesStore';
