import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { setLanguagePreference } from '@/features/core/translations/state/languageStore';
export { currentLanguage, currentLocaleTag, tr } from '@/features/core/translations/tr';
export {
  type Language,
  resolveLanguage,
  type TKey,
  type TVars,
  translate,
} from '@/features/core/translations/translate';
export { useT } from '@/features/core/translations/useT';
