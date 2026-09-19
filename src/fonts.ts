/**
 * Font loading, kept out of the provider tree so bootstrap can await it as one
 * of several independent readiness gates.
 *
 * The families are loaded by their generated postscript-style names, which is
 * also what `fontFamily` in `src/theme/tokens.ts` refers to. Only the weights
 * the design actually uses are bundled — nine faces, not the full matrix —
 * because every extra weight is download size the first launch pays for.
 */
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { loadAsync } from 'expo-font';

export const APP_FONTS = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} as const;

export function loadAppFonts(): Promise<void> {
  return loadAsync(APP_FONTS);
}
