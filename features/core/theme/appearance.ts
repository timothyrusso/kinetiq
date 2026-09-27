/** The scheme a theme is drawn in, once `system` has been resolved against the OS. */
export type ThemeMode = 'light' | 'dark';

/** What the user picked: a fixed scheme, or whatever the OS is showing. */
export type ThemePreference = 'system' | ThemeMode;

/**
 * Accent colours offered on Android. `system` is Material You (the wallpaper palette, Android
 * 12+); the named ones are seed colours the Material 3 generator turns into a full light and dark
 * palette, so each keeps its contrast in both modes.
 */
export const ACCENT_CHOICES = ['kinetiq', 'system', 'ocean', 'sunset', 'berry', 'ruby'] as const;
export type AccentChoice = (typeof ACCENT_CHOICES)[number];

/** The two appearance preferences the theme is built from. */
export interface AppearancePreferences {
  readonly themePreference: ThemePreference;
  readonly accentColor: AccentChoice;
}
