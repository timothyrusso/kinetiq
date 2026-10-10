import { Appearance, type ColorSchemeName } from 'react-native';
import type { ThemePreference } from '@/features/core/theme/appearance';

/** The OS appearance before the app first overrode it; `undefined` until something asks. */
let launchScheme: ColorSchemeName | null | undefined;

/**
 * The OS appearance at launch, read once and kept. After {@link applyNativeColorScheme} pins the
 * window to the app's theme, `Appearance` and `useColorScheme()` report the app's choice, not the
 * OS's; the splash handover is the one place that needs what the OS drew, and only at launch.
 */
export function launchColorScheme(): ColorSchemeName | null {
  if (launchScheme === undefined) launchScheme = Appearance.getColorScheme() ?? null;
  return launchScheme;
}

/**
 * Pins the native appearance to the user's preference, so UIKit and Android views follow the app's
 * theme rather than the phone's. Without it the iOS 26 tab bar, whose override react-native-screens
 * resets to "unspecified" on every tab switch, drew dark glass over a light app on a dark phone.
 * `system` hands control back to the OS. On Android `uiMode` is in `configChanges`, so changing the
 * night mode does not recreate the activity.
 */
export function applyNativeColorScheme(preference: ThemePreference): void {
  launchColorScheme();
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}
