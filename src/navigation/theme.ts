/**
 * Maps Kinetiq's theme onto React Navigation's theme object.
 *
 * React Navigation still needs a theme even with `contentStyle` overriding every
 * surface it draws, for two things it renders itself and cannot be styled away: the
 * `cardStyle` defaults of native-stack and the accessibility traits of its back
 * gesture. Handing it the default blue-white palette would mean the navigation
 * primitives disagree with the app they contain: visible as a white flash behind a
 * dark screen during a native push on iOS.
 *
 * Built from `themeFor` rather than a hook so this stays a module constant: these two
 * objects are compared by identity by React Navigation's theme context, and a fresh
 * object per render would re-theme every navigator on every render.
 */
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';

import { themeFor } from '@/theme/theme';

function toNavigationTheme(mode: 'light' | 'dark'): NavigationTheme {
  const theme = themeFor(mode);
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}

export const NAV_LIGHT_THEME = toNavigationTheme('light');
export const NAV_DARK_THEME = toNavigationTheme('dark');
