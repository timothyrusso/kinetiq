import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { loadAsync } from 'expo-font';

/**
 * The app's faces. Inter is the typeface: a UI face with a tall x-height and unambiguous 1/l/I
 * and 0/O, read at arm's length mid-set, with the whole weight ramp, so hierarchy comes from one
 * family. Five weights, not the matrix: every face is download size the first launch pays for,
 * and italics are never used. JetBrains Mono has one job, values that must not reflow as their
 * digits change (the running timer): proportional digits make a timer jitter on every tick.
 *
 * Imported by subpath, not from the package root: the root re-exports a `useFonts` this app does
 * not use, and resolving it is an avoidable failure for code that runs before the first frame.
 */
const APP_FONTS = {
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
