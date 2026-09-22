/**
 * `t()` outside React.
 *
 * Services produce user-facing sentences too: the location recorder explains why distance is
 * being estimated, the notification scheduler writes a body, the persistence layer names a
 * failure. None of them can call a hook, and passing a translator down through a singleton's
 * constructor would mean the language could not change after it was built.
 *
 * So the language is read at call time from the settings store, which is the same source
 * `useT` subscribes to. The difference is only in *when*: a component re-renders when the
 * language changes, while a service composes its string at the moment it needs one, which is
 * exactly when the current language is the right one.
 *
 * Kept in its own module so `src/i18n/index.ts` stays free of a settings dependency: the
 * catalog is data, and data that imports a store is a cycle waiting to happen.
 */
import { getSettings } from '@/settings/store';

import { translate, type TKey, type TVars } from './index';

export function tr(key: TKey, vars?: TVars): string {
  return translate(getSettings().language, key, vars);
}
