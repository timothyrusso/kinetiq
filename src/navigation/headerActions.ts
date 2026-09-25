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
 * in a header is read, not recognised. (On Android they draw their Material glyph: the top
 * app bar only takes icons, and Material's confirming action is the check.)
 */
import type { SFSymbol } from 'sf-symbols-typescript';

import type { TKey } from '@/i18n';
import type { MaterialIconName } from '@/ui/materialIcons';

export type HeaderActionKey =
  | 'add'
  | 'more'
  | 'play'
  | 'delete'
  | 'save'
  | 'cancel';

export type HeaderActionRow = {
  sf: SFSymbol;
  material: MaterialIconName;
  label: TKey;
  /** Rendered as its label on iOS; Android draws the glyph (see the note above). */
  text?: true;
};

export const HEADER_ACTIONS: Record<HeaderActionKey, HeaderActionRow> = {
  add: { sf: 'plus', material: 'add', label: 'headerActions.add' },
  more: { sf: 'ellipsis', material: 'more-vert', label: 'headerActions.more' },
  play: { sf: 'play.fill', material: 'play-arrow', label: 'headerActions.play' },
  delete: { sf: 'trash', material: 'delete', label: 'headerActions.delete' },
  save: { sf: 'checkmark', material: 'check', label: 'headerActions.save', text: true },
  // "Cancel" on iOS, the full-screen dialog's close glyph on Android.
  cancel: { sf: 'xmark', material: 'close', label: 'headerActions.cancel', text: true },
};
