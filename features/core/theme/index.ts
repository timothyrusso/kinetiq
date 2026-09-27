import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { useAccentSwatches } from '@/features/core/theme/accent';
export {
  ACCENT_CHOICES,
  type AccentChoice,
  type AppearancePreferences,
  type ThemeMode,
  type ThemePreference,
} from '@/features/core/theme/appearance';
export { setAppearancePreferences } from '@/features/core/theme/state/appearanceStore';
export { statusBarStyle, type Theme, themeFor, useAppTheme } from '@/features/core/theme/theme';
export {
  disabledContentAlpha,
  fontFamily,
  motion,
  palette,
  radius,
  screenGutter,
  spacing,
  touchTarget,
  z,
} from '@/features/core/theme/tokens';
