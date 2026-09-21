/**
 * Font loading, kept out of the provider tree so bootstrap can await it as one
 * of several independent readiness gates.
 *
 * Inter is the app's typeface. It is a UI face designed for screens: tall
 * x-height, open apertures, and unambiguous 1/l/I and 0/O, which matters on a
 * screen read at arm's length mid-set. It also ships the full weight ramp the
 * design uses, so hierarchy comes from one family rather than from mixing
 * three, which is what this file used to do.
 *
 * Five weights, not the whole matrix: every extra face is download size the
 * first launch pays for, and italics are never used in this UI.
 *
 * JetBrains Mono stays for one job only: values that must not reflow as their
 * digits change (the running timer, live pace). Proportional digits make a
 * timer jitter on every tick; that is a mechanical requirement, not a style
 * choice, so it keeps its own face.
 *
 * Imported by subpath rather than from the package root: the root entry
 * re-exports a `useFonts` helper this app does not use, and resolving it is an
 * avoidable failure mode for a file that runs before the first frame.
 */
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { loadAsync } from 'expo-font';

export const APP_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} as const;

export function loadAppFonts(): Promise<void> {
  return loadAsync(APP_FONTS);
}
