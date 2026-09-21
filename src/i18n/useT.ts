/**
 * `t()` bound to the user's current language.
 *
 * Subscribes through `useSettings` with a scalar selector, so a screen re-renders when the
 * language changes and on nothing else. The returned function is memoised on the language
 * alone: an unstable `t` would defeat every `memo` and `useMemo` that takes a label as a
 * dependency, which is most of them.
 */
import { useCallback, useMemo } from 'react';

import { useSettings } from '@/settings';
import { localeTag, translate, type TKey, type TVars } from './index';

export function useT(): {
  t: (key: TKey, vars?: TVars) => string;
  /** For `Intl` formatters: dates, times, numbers. */
  locale: string;
} {
  const language = useSettings((s) => s.language);
  const t = useCallback((key: TKey, vars?: TVars) => translate(language, key, vars), [language]);
  const locale = useMemo(() => localeTag(language), [language]);
  return { t, locale };
}
