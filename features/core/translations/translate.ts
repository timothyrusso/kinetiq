/**
 * Translation, with no dependency.
 *
 * ~700 strings is well inside what a typed object handles, and the alternative costs more than
 * it gives here: a library brings its own key syntax, its own plural engine and its own loader,
 * and this app needs two locales, `{name}` substitution and one plural rule.
 *
 * ## Why the key type is derived
 *
 * `TKey` is computed from the English catalog, so `t('home.thisWeeek')` does not compile. That
 * is the whole reason to hand-roll this: a runtime lookup returning the key back as a string is
 * how a typo ships as a label reading "home.thisWeeek".
 *
 * ## Plurals
 *
 * `t('workout.set', { count })` resolves `set_one` or `set_other`. English and Italian happen to
 * share the same two-form rule, which is why this is a conditional rather than a CLDR table. A
 * third locale with a different rule would need the table, and that is the point at which a
 * library earns its place.
 *
 * ## Where the locale lives
 *
 * It is a setting: it persists with the others and restores on launch with them. The settings
 * store mirrors it into `state/languageStore.ts`, which is what `useT` and `tr` read, so this
 * core module depends on nothing above it.
 */
import { getLocales } from 'expo-localization';

import { type Copy, en } from '@/features/core/translations/catalog/en';
import { it } from '@/features/core/translations/catalog/it';

export type Language = 'system' | 'en' | 'it';

const CATALOGS: Record<'en' | 'it', Copy> = { en, it };

/**
 * Every leaf path in the catalog, with the plural suffixes collapsed.
 *
 * `home.streak_one` and `home.streak_other` both become `home.streak`, because a caller asks
 * for the concept and passes a count; asking for a specific plural form at a call site is how
 * plural bugs get written.
 */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? K extends `${infer B}_one` | `${infer B}_other`
      ? `${P}${B}`
      : `${P}${K}`
    : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Copy>;

/** Values substituted into `{placeholder}` slots. `count` also selects the plural form. */
export type TVars = Record<string, string | number> & { count?: number };

/** The language a setting renders in: `system` resolves against the device's preference list. */
export function resolveLanguage(language: Language): 'en' | 'it' {
  if (language !== 'system') return language;
  // NOTE: `getLocales()` is ordered by the user's own preference list, so the first Italian entry
  // anywhere in it beats an English entry further down.
  const tags = getLocales().map(l => l.languageCode ?? '');
  return tags.includes('it') ? 'it' : 'en';
}

function lookup(catalog: Copy, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, catalog);
}

/**
 * Resolves one key. Exported for the places that cannot use the hook: a notification body built
 * in a background task, a validation message thrown from the persistence layer.
 */
export function translate(language: Language, key: TKey, vars?: TVars): string {
  const catalog = CATALOGS[resolveLanguage(language)];
  const count = vars?.count;

  let raw = count === undefined ? undefined : lookup(catalog, `${key}_${count === 1 ? 'one' : 'other'}`);
  raw ??= lookup(catalog, key);

  if (typeof raw !== 'string') {
    // NOTE: Loud in development, harmless in production: a missing key is a bug, and the key itself is
    // the most useful thing to show while finding it. `check:i18n` exists so this never ships.
    // biome-ignore lint/suspicious/noConsole: a development-only warning, before any Logger exists for plain code
    if (__DEV__) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (!vars) return raw;

  return raw.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const value = vars[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

/** The BCP 47 tag for `Intl` formatters: dates, times and numbers. */
export function localeTag(language: Language): string {
  return resolveLanguage(language) === 'it' ? 'it-IT' : 'en-GB';
}
