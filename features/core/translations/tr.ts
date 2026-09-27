/**
 * `t()` outside React.
 *
 * Services produce user-facing sentences too: the location recorder explains why distance is
 * being estimated, the notification scheduler writes a body, the persistence layer names a
 * failure. None of them can call a hook, and passing a translator down through a singleton's
 * constructor would mean the language could not change after it was built.
 *
 * So the language is read at call time from the language store, which is the same source
 * `useT` subscribes to. The difference is only in *when*: a component re-renders when the
 * language changes, while a service composes its string at the moment it needs one, which is
 * exactly when the current language is the right one.
 *
 * Kept in its own module so `translate.ts` stays free of a store dependency: the
 * catalog is data, and data that imports a store is a cycle waiting to happen.
 */
import { useLanguageStore } from '@/features/core/translations/state/languageStore';
import { localeTag, resolveLanguage, type TKey, type TVars, translate } from '@/features/core/translations/translate';

export function tr(key: TKey, vars?: TVars): string {
  return translate(useLanguageStore.getState().language, key, vars);
}

/** The language the app is rendering in right now, for code that picks data rather than copy. */
export function currentLanguage(): 'en' | 'it' {
  return resolveLanguage(useLanguageStore.getState().language);
}

/** The BCP 47 tag of the current language, for `Intl` formatters outside React. */
export function currentLocaleTag(): string {
  return localeTag(useLanguageStore.getState().language);
}
