/**
 * `t()` bound to the user's current language.
 *
 * Subscribes to the language store's one key, so a screen re-renders when the
 * language changes and on nothing else. The returned function is memoised on the language
 * alone: an unstable `t` would defeat every `memo` and `useMemo` that takes a label as a
 * dependency, which is most of them.
 */
import { useCallback, useMemo } from 'react';

import { useLanguageStore } from '@/features/core/translations/state/languageStore';
import { localeTag, type TKey, type TVars, translate } from '@/features/core/translations/translate';

export function useT(): {
  t: (key: TKey, vars?: TVars) => string;
  /** For `Intl` formatters: dates, times, numbers. */
  locale: string;
} {
  const language = useLanguageStore.use.language();
  const t = useCallback((key: TKey, vars?: TVars) => translate(language, key, vars), [language]);
  const locale = useMemo(() => localeTag(language), [language]);
  return { t, locale };
}
