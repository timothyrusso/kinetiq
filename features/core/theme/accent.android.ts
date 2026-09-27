/**
 * The Android accent: Material You or a seeded Material 3 palette, through `@expo/ui`.
 *
 * `useMaterialColors` returns the wallpaper palette (Android 12+) when given no seed, and a
 * palette generated from `seedColor` otherwise, in the requested light or dark scheme. Taking
 * `primary` / `onPrimary` from it, rather than tinting one hex ourselves, is what keeps text on
 * the accent legible in both modes for every choice.
 *
 * The hook is called on every render whatever the choice, so the hook order never changes; the
 * brand choice simply ignores its answer.
 */

import { isDynamicColorAvailable, useMaterialColors } from '@expo/ui/jetpack-compose';
import { useMemo } from 'react';
import type { AccentColors } from '@/features/core/theme/accent';
import type { AccentChoice, ThemeMode } from '@/features/core/theme/appearance';
import { useAppearanceStore } from '@/features/core/theme/state/appearanceStore';
import { palette as brand } from '@/features/core/theme/tokens';
import { withAlpha } from '@/features/core/utils';

export type { AccentColors } from '@/features/core/theme/accent';

/** Seed colours for the named choices. `kinetiq` and `system` have none. */
const SEEDS: Partial<Record<AccentChoice, string>> = {
  ocean: '#1E88E5',
  sunset: '#F57C00',
  berry: '#8E24AA',
  ruby: '#E53935',
};

/** Material colours arrive as `#RRGGBBAA`; the rest of the theme speaks `#RRGGBB`. */
function rgb(hex: string): string {
  return hex.slice(0, 7);
}

export function useAccentColors(mode: ThemeMode): AccentColors | null {
  const choice = useAppearanceStore.use.accentColor();
  const seed = SEEDS[choice];
  const palette = useMaterialColors({ colorScheme: mode, ...(seed ? { seedColor: seed } : {}) });
  const primary = rgb(palette.primary);
  const onPrimary = rgb(palette.onPrimary);
  const container = rgb(palette.primaryContainer);
  // NOTE: Keyed on the strings, not on `palette`: a new object per render would make a new theme per
  // render, and every memoised row that takes `theme` would redraw for nothing.
  return useMemo(() => {
    if (choice === 'kinetiq') return null;
    return {
      accent: primary,
      accentSoft: withAlpha(primary, mode === 'dark' ? 0.16 : 0.12),
      onAccent: onPrimary,
      accentStrong: container,
      focusRing: withAlpha(primary, 0.4),
      areaFrom: withAlpha(primary, mode === 'dark' ? 0.34 : 0.2),
      areaTo: withAlpha(primary, 0),
    };
  }, [choice, container, mode, onPrimary, primary]);
}

/**
 * Swatches for the picker, in the scheme the app is drawn in. The wallpaper choice is offered
 * only where Material You exists (Android 12+); below that it would be the static baseline
 * palette under a misleading name.
 */
export function useAccentSwatches(mode: ThemeMode): Partial<Record<AccentChoice, string>> {
  const wallpaper = useMaterialColors({ colorScheme: mode });
  const ocean = useMaterialColors({ colorScheme: mode, seedColor: SEEDS.ocean });
  const sunset = useMaterialColors({ colorScheme: mode, seedColor: SEEDS.sunset });
  const berry = useMaterialColors({ colorScheme: mode, seedColor: SEEDS.berry });
  const ruby = useMaterialColors({ colorScheme: mode, seedColor: SEEDS.ruby });
  return {
    // NOTE: The brand accent is the theme's own: lime on dark, the deeper volt on light.
    kinetiq: mode === 'dark' ? brand.volt : '#5E8C0B',
    ...(isDynamicColorAvailable ? { system: rgb(wallpaper.primary) } : {}),
    ocean: rgb(ocean.primary),
    sunset: rgb(sunset.primary),
    berry: rgb(berry.primary),
    ruby: rgb(ruby.primary),
  };
}
