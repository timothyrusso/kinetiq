/**
 * Every action a navigation header can carry, and the one place its icon is named.
 *
 * A header action has three faces: the SF Symbol iOS draws, the Material glyph Android draws,
 * and the words a screen reader says. Keeping all three in one row per action is what stops
 * the settings gear being `gearshape` on one screen and `gear` on another, or a trash can with
 * no label on the screen where someone forgot to write one.
 *
 * Labels are catalog KEYS, not words: this table is built at import time, before a language
 * exists. `text` rows (`save`, `done`) are words on both platforms, because a confirming verb
 * in a header is read, not recognised.
 */
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { TKey } from '@/i18n';

export type HeaderActionKey =
  | 'settings'
  | 'filter'
  | 'add'
  | 'more'
  | 'play'
  | 'delete'
  | 'save'
  | 'done'
  | 'edit'
  | 'share'
  | 'search'
  | 'cancel';

export type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

export type HeaderActionRow = {
  sf: SFSymbol;
  material: MaterialIconName;
  label: TKey;
  /** Rendered as its label rather than as a glyph, on both platforms. */
  text?: true;
  /**
   * Drawn on iOS only. A modal's leading "Cancel" is the iOS convention; Android's modal
   * already carries the system back arrow, and a second way out beside it reads as a mistake.
   */
  iosOnly?: true;
};

export const HEADER_ACTIONS: Record<HeaderActionKey, HeaderActionRow> = {
  settings: { sf: 'gearshape', material: 'settings', label: 'headerActions.settings' },
  filter: { sf: 'line.3.horizontal.decrease', material: 'filter-list', label: 'headerActions.filter' },
  add: { sf: 'plus', material: 'add', label: 'headerActions.add' },
  more: { sf: 'ellipsis', material: 'more-vert', label: 'headerActions.more' },
  play: { sf: 'play.fill', material: 'play-arrow', label: 'headerActions.play' },
  delete: { sf: 'trash', material: 'delete', label: 'headerActions.delete' },
  save: { sf: 'checkmark', material: 'check', label: 'headerActions.save', text: true },
  done: { sf: 'checkmark', material: 'check', label: 'headerActions.done', text: true },
  edit: { sf: 'pencil', material: 'edit', label: 'headerActions.edit' },
  share: { sf: 'square.and.arrow.up', material: 'share', label: 'headerActions.share' },
  search: { sf: 'magnifyingglass', material: 'search', label: 'headerActions.search' },
  cancel: { sf: 'xmark', material: 'close', label: 'headerActions.cancel', text: true, iosOnly: true },
};
