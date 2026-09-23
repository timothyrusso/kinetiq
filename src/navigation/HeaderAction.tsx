/**
 * One header action, drawn by the platform's own navigation bar.
 *
 * ## A function, not a component
 *
 * `Stack.Toolbar` reads its children by element TYPE: it keeps the direct children that are a
 * `Stack.Toolbar.Button` or `Stack.Toolbar.Menu` and turns their props into native bar items.
 * A `<HeaderAction>` component would be an unknown type at that level and be dropped without a
 * sound, so this returns the button element itself and a screen writes
 * `{headerAction({ action: 'settings', onPress, t })}` inside its toolbar.
 *
 * ## Icons per platform
 *
 * iOS takes the SF Symbol name directly. Android's bar only accepts an image source (an SF name
 * is silently ignored, and a button with no image is not drawn at all), so every Material glyph
 * in the table is rendered to an image once, during bootstrap, before the navigator mounts. A
 * row whose image is somehow missing renders nothing rather than an empty tappable square.
 */
import type { ReactElement } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import type { SFSymbol } from 'sf-symbols-typescript';

import type { TKey, TVars } from '@/i18n';
import { materialIcon, prefetchMaterialIcons, type MaterialIconName } from '@/ui/materialIcons';
import { HEADER_ACTIONS, type HeaderActionKey } from './headerActions';

/** Glyphs the settings lists draw on Android, beside the header's own. */
const LIST_GLYPHS: readonly MaterialIconName[] = ['chevron-right', 'remove', 'add', 'check'];

/** Bootstrap calls this before the first navigator renders. A no-op off Android. */
export function prefetchHeaderIcons(): Promise<void> {
  const header = Object.values(HEADER_ACTIONS).map((row) => row.material);
  return prefetchMaterialIcons([...header, ...LIST_GLYPHS]);
}

/**
 * `Stack.Toolbar` under a name that cannot collide with the `Stack` layout primitive most
 * screens already import from `@/ui/layout`. Same component, so `HeaderToolbar.Menu` and
 * `HeaderToolbar.MenuAction` are the router's own.
 */
export const HeaderToolbar = Stack.Toolbar;

/** The native header search field, under the same collision-free naming. */
export const HeaderSearchBar = Stack.SearchBar;

export type HeaderActionOptions = {
  action: HeaderActionKey;
  onPress: () => void;
  t: (key: TKey, vars?: TVars) => string;
  /** A more specific spoken label than the table's ("New routine" rather than "Add"). */
  label?: TKey;
  disabled?: boolean;
  /** Marks a destructive or primary action the platform way (`done` is bold on iOS). */
  variant?: 'plain' | 'done' | 'prominent';
  /**
   * The colour of a `done` action. iOS 26 draws it as a filled capsule in the system blue
   * unless told otherwise, and the bar's tint does not reach it.
   */
  tint?: string;
};

export function headerAction({
  action,
  onPress,
  t,
  label,
  disabled,
  variant,
  tint,
}: HeaderActionOptions): ReactElement | null {
  const row = HEADER_ACTIONS[action];
  const spoken = t(label ?? row.label);
  const shared = {
    onPress,
    accessibilityLabel: spoken,
    ...(disabled === undefined ? {} : { disabled }),
    ...(variant === undefined ? {} : { variant }),
    ...(tint === undefined ? {} : { tintColor: tint }),
  };
  // A word on iOS, where a confirming verb in a bar is read. Android's top bar only draws
  // icons (a text-only toolbar button renders nothing there), and Material's confirming
  // action is the check glyph, so text rows fall through to their icon with the label as
  // the spoken name.
  if (row.text && Platform.OS === 'ios') {
    return <Stack.Toolbar.Button key={action} {...shared}>{spoken}</Stack.Toolbar.Button>;
  }
  if (Platform.OS === 'android') {
    const source = materialIcon(row.material);
    if (!source) return null;
    return <Stack.Toolbar.Button key={action} {...shared} icon={source} />;
  }
  return <Stack.Toolbar.Button key={action} {...shared} icon={row.sf} />;
}

export type HeaderMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  /** iOS draws a symbol beside the item; Android's menu is text, as Material menus are. */
  sf?: SFSymbol;
  destructive?: boolean;
};

/**
 * A header action that opens the platform's own menu: a pull-down on iOS, a dropdown on
 * Android. Returned as an element for the same reason as `headerAction`: `Stack.Toolbar`
 * reads menus by element type, and so does the menu itself for its items.
 */
export function headerMenu({
  action,
  t,
  label,
  items,
}: {
  action: HeaderActionKey;
  t: (key: TKey, vars?: TVars) => string;
  label?: TKey;
  items: readonly HeaderMenuItem[];
}): ReactElement | null {
  const row = HEADER_ACTIONS[action];
  const icon = Platform.OS === 'android' ? materialIcon(row.material) : row.sf;
  if (!icon) return null;
  return (
    <Stack.Toolbar.Menu key={action} icon={icon} accessibilityLabel={t(label ?? row.label)}>
      {items.map((item) => (
        <Stack.Toolbar.MenuAction
          key={item.key}
          onPress={item.onPress}
          {...(Platform.OS === 'ios' && item.sf ? { icon: item.sf } : {})}
          {...(item.destructive ? { destructive: true } : {})}
        >
          {item.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}
