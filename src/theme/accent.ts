/**
 * The accent the user picked, as theme colours, or `null` for the brand accent.
 *
 * iOS keeps the brand lime: the accent picker is an Android preference, where a Material You
 * palette is the platform's own convention. `accent.android.ts` is the real implementation.
 */
import type { AccentChoice } from '@/settings';
import type { ThemeMode } from './theme';

export type AccentColors = {
  accent: string;
  accentSoft: string;
  onAccent: string;
  accentStrong: string;
  focusRing: string;
  areaFrom: string;
  areaTo: string;
};

export function useAccentColors(_mode: ThemeMode): AccentColors | null {
  return null;
}

/** No picker on iOS, so no swatches; present so the shared import type-checks. */
export function useAccentSwatches(_mode: ThemeMode): Record<AccentChoice, string> | null {
  return null;
}
