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
 * is silently ignored there), so every Material glyph in the table is rendered to an image once,
 * during bootstrap, before the navigator mounts. A row whose image is somehow missing renders
 * nothing rather than an empty tappable square.
 */
import type { ReactElement } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack } from 'expo-router';

import type { SFSymbol } from 'sf-symbols-typescript';

import type { TKey, TVars } from '@/i18n';
import { HEADER_ACTIONS, type HeaderActionKey } from './headerActions';

/** Rendered once at 24 dp; the bar tints template images itself, so one colour serves every theme. */
const ANDROID_ICON_SIZE = 24;
const androidSources = new Map<HeaderActionKey, ImageSourcePropType>();

/** Bootstrap calls this before the first navigator renders. A no-op off Android. */
export async function prefetchHeaderIcons(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const keys = Object.keys(HEADER_ACTIONS) as HeaderActionKey[];
  await Promise.all(
    keys.map(async (key) => {
      if (HEADER_ACTIONS[key].text) return;
      const source = await MaterialIcons.getImageSource(
        HEADER_ACTIONS[key].material,
        ANDROID_ICON_SIZE,
        '#000000',
      ).catch(() => null);
      if (source) androidSources.set(key, source);
    }),
  );
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
  if (row.iosOnly && Platform.OS !== 'ios') return null;
  const spoken = t(label ?? row.label);
  const shared = {
    onPress,
    accessibilityLabel: spoken,
    ...(disabled === undefined ? {} : { disabled }),
    ...(variant === undefined ? {} : { variant }),
    ...(tint === undefined ? {} : { tintColor: tint }),
  };
  if (row.text) {
    return <Stack.Toolbar.Button key={action} {...shared}>{spoken}</Stack.Toolbar.Button>;
  }
  if (Platform.OS === 'android') {
    const source = androidSources.get(action);
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
  const icon = Platform.OS === 'android' ? androidSources.get(action) : row.sf;
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
