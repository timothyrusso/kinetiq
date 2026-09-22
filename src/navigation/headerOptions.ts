/**
 * How every navigation header in the app looks, in one place.
 *
 * The root stack and the five tab stacks all draw the platform's own header. They share these
 * options so a pushed screen and a tab cannot disagree about the bar's colour, tint or shadow:
 * the header used to be configured per screen inside `DetailScreen`, and two headers that
 * disagreed by one property were the kind of drift this app has paid for before.
 *
 * Titles are the platform's font on purpose. A native bar set in the app's display face reads
 * as a drawn imitation of one, which is what the custom bars this replaces were.
 */
import { useMemo } from 'react';
import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from 'expo-router/native-stack';

import { useAppTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

export function useHeaderOptions(): NativeStackNavigationOptions {
  const theme = useAppTheme();
  return useMemo(
    () => ({
      headerShown: true,
      // No bar colour on iOS. The bar is the system material over the content, and an opaque
      // colour there does worse than look wrong: inside a tab's stack it paints over the large
      // title, which then exists (it is in the accessibility tree, in the right place) and is
      // not visible. Material's top app bar is a surface, so Android gets the canvas colour.
      ...(Platform.OS === 'android' ? { headerStyle: { backgroundColor: theme.colors.background } } : {}),
      contentStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.accent,
      headerTitleStyle: { color: theme.colors.text },
      headerLargeTitleStyle: { color: theme.colors.text },
      // The system draws the hairline once a large title has collapsed; at rest it would be a
      // line across an empty bar.
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      // Chevron only, the iOS 26 idiom. The previous screen's title still appears in the
      // back button's long-press history menu.
      headerBackButtonDisplayMode: 'minimal',
    }),
    [theme],
  );
}

/** The large-title variant for hubs and lists: the five tabs and the settings-style screens. */
export function useLargeTitleOptions(): NativeStackNavigationOptions {
  const base = useHeaderOptions();
  return useMemo(() => ({ ...base, headerLargeTitle: true }), [base]);
}

/**
 * A route presented as the platform's own sheet.
 *
 * `[0.5, 1]` for pickers (a glance at half height, the whole list a drag away); `fit` for short
 * forms, which size to their content. The grabber is always shown, because a sheet you can
 * resize should say so. The radius is the app's largest, the same one the drawn sheets used.
 */
export function formSheet(detents: 'fit' | 'picker'): NativeStackNavigationOptions {
  return {
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    sheetAllowedDetents: detents === 'fit' ? 'fitToContents' : [0.5, 1],
    sheetCornerRadius: radius.xxl,
  };
}
