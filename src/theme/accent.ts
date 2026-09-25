/**
 * The accent the user picked, as theme colours, or `null` for the brand accent.
 *
 * iOS has no Material You, so each named choice is a fixed pair of hand-picked colours: a deeper
 * one on light paper (white text on it must stay legible) and a lighter one on black (dark ink on
 * it). There is no wallpaper choice here; `accent.android.ts` is the Material 3 implementation.
 */
import { useMemo } from 'react';

import { useSettings } from '@/settings';
import type { AccentChoice } from '@/settings';
import { palette } from '@/theme/tokens';
import { withAlpha } from '@/utils/color';
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

type Preset = { accent: string; accentStrong: string; onAccent: string };

const PRESETS: Partial<Record<AccentChoice, Record<ThemeMode, Preset>>> = {
  ocean: {
    light: {
      accent: '#0A66C2',
      accentStrong: '#084F96',
      onAccent: palette.white,
    },
    dark: { accent: '#4DA3FF', accentStrong: '#7DBBFF', onAccent: '#001A33' },
  },
  sunset: {
    light: {
      accent: '#C25400',
      accentStrong: '#9A4300',
      onAccent: palette.white,
    },
    dark: { accent: '#FF9F43', accentStrong: '#FFB870', onAccent: '#2B1400' },
  },
  berry: {
    light: {
      accent: '#8E3FC8',
      accentStrong: '#7030A0',
      onAccent: palette.white,
    },
    dark: { accent: '#C58AF9', accentStrong: '#D8ABFF', onAccent: '#240A3A' },
  },
  ruby: {
    light: {
      accent: '#C62828',
      accentStrong: '#9E1F1F',
      onAccent: palette.white,
    },
    dark: { accent: '#FF7A85', accentStrong: '#FF9EA6', onAccent: '#3A0008' },
  },
};

export function useAccentColors(mode: ThemeMode): AccentColors | null {
  const choice = useSettings((s) => s.accentColor);
  return useMemo(() => {
    const preset = PRESETS[choice]?.[mode];
    if (!preset) return null;
    return {
      ...preset,
      accentSoft: withAlpha(preset.accent, mode === 'dark' ? 0.16 : 0.12),
      focusRing: withAlpha(preset.accent, 0.4),
      areaFrom: withAlpha(preset.accent, mode === 'dark' ? 0.34 : 0.2),
      areaTo: withAlpha(preset.accent, 0),
    };
  }, [choice, mode]);
}

/** Swatches for the picker, in the scheme the app is drawn in. A missing choice is not offered. */
export function useAccentSwatches(mode: ThemeMode): Partial<Record<AccentChoice, string>> {
  return useMemo(
    () => ({
      kinetiq: mode === 'dark' ? palette.volt : '#5E8C0B',
      ocean: PRESETS.ocean?.[mode].accent,
      sunset: PRESETS.sunset?.[mode].accent,
      berry: PRESETS.berry?.[mode].accent,
      ruby: PRESETS.ruby?.[mode].accent,
    }),
    [mode],
  );
}
