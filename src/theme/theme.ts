/**
 * Semantic theme. Components consume `theme.*` only: never raw palette ramps, * so light and dark can diverge freely.
 *
 * Dark is a true-black "training at night" surface with neutral grey lifts and a volt accent.
 * Light is warm paper with a *deeper* volt accent for contrast: the bright lime
 * that pops on ink is illegible on paper, so the accent itself shifts hue.
 */
import { useMemo } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { useThemeMode } from '@/settings';
import { useAccentColors } from './accent';
import {
  palette,
  platformSurface,
  radius,
  spacing,
  fontSize,
  weight,
  lineHeight,
  motion,
  type PlatformSurface,
} from './tokens';

export type ThemeMode = 'light' | 'dark';

type Shadow = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
} | null;

export type Theme = {
  mode: ThemeMode;
  /** Launch/splash-matching background, also used by native config. */
  brandBackground: string;
  colors: {
    /** App canvas behind everything. */
    background: string;
    /** Grouped-list background; distinct from `background` on iOS-style sheets. */
    canvas: string;
    /** Standard card surface. */
    surface: string;
    /** Slightly lifted surface for nested content. */
    surfaceRaised: string;
    /** Pressed/dragged state for surfaces. */
    surfacePressed: string;
    /** Frosted overlays (tab bar, sticky headers). */
    overlay: string;
    overlayBorder: string;

    text: string;
    textMuted: string;
    textFaint: string;
    textInverse: string;

    /** Primary brand accent (lime in dark, deep volt in light). */
    accent: string;
    accentSoft: string;
    /** Text/icons placed on top of `accent`. */
    onAccent: string;
    accentStrong: string;

    secondary: string;
    secondarySoft: string;
    onSecondary: string;

    tertiary: string;
    tertiarySoft: string;

    danger: string;
    dangerSoft: string;
    onDanger: string;
    warning: string;
    warningSoft: string;
    success: string;
    successSoft: string;
    info: string;
    infoSoft: string;

    border: string;
    borderStrong: string;
    hairline: string;
    /** Skeleton/placeholder shimmer. */
    placeholder: string;
    /** Scrim behind modals and confirmations. */
    scrim: string;
    /** Ring/tint on focused inputs. */
    focusRing: string;

    /** Chart primitives. */
    chartGrid: string;
    chartAxis: string;
    series: [string, string, string, string];
    /** Gradient stops for area fills (strong -> transparent). */
    areaFrom: string;
    areaTo: string;
  };
  gradients: {
    hero: readonly [string, ...string[]];
    accent: readonly [string, ...string[]];
    surface: readonly [string, ...string[]];
    /** Fades a card into the canvas beneath charts. */
    fade: readonly [string, string];
  };
  shadows: {
    none: Shadow;
    card: Shadow;
    raised: Shadow;
    accent: Shadow;
  };
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  weight: typeof weight;
  lineHeight: typeof lineHeight;
  motion: typeof motion;
  /** Grouped-surface skin for this platform: see `PlatformSurface`. */
  surfaceSkin: PlatformSurface;
  /** 1 on small phones, 1.06 on tablets: used to scale display type only. */
  scale: number;
};

const darkColors = {
  background: palette.ink900,
  canvas: palette.ink900,
  surface: palette.ink700,
  surfaceRaised: palette.ink600,
  surfacePressed: palette.ink500,
  overlay: 'rgba(0, 0, 0, 0.82)',
  overlayBorder: 'rgba(255, 255, 255, 0.09)',

  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  textFaint: '#6E6E73',
  textInverse: '#000000',

  accent: palette.volt,
  accentSoft: 'rgba(198, 242, 78, 0.14)',
  onAccent: palette.voltInk,
  accentStrong: '#D8FF6E',

  secondary: palette.spark,
  secondarySoft: 'rgba(53, 232, 192, 0.14)',
  onSecondary: '#04231C',

  tertiary: palette.plum,
  tertiarySoft: 'rgba(185, 140, 255, 0.16)',

  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.15)',
  onDanger: '#2A0708',
  warning: '#FFC24D',
  warningSoft: 'rgba(255, 194, 77, 0.15)',
  success: palette.spark,
  successSoft: 'rgba(53, 232, 192, 0.15)',
  info: palette.azure,
  infoSoft: 'rgba(90, 168, 255, 0.15)',

  border: palette.ink500,
  borderStrong: palette.ink400,
  hairline: palette.inkHairline,
  placeholder: palette.ink600,
  scrim: 'rgba(0, 0, 0, 0.72)',
  focusRing: 'rgba(198, 242, 78, 0.45)',


  chartGrid: 'rgba(255, 255, 255, 0.055)',
  chartAxis: '#6E6E73',
  series: [palette.volt, palette.spark, palette.azure, palette.coral] as [
    string,
    string,
    string,
    string,
  ],
  areaFrom: 'rgba(198, 242, 78, 0.34)',
  areaTo: 'rgba(198, 242, 78, 0)',
} satisfies Theme['colors'];

const lightColors = {
  background: palette.paper0,
  canvas: palette.paper100,
  surface: palette.white,
  surfaceRaised: palette.white,
  surfacePressed: palette.paper200,
  overlay: 'rgba(251, 251, 248, 0.86)',
  overlayBorder: 'rgba(10, 14, 24, 0.08)',

  text: palette.slate900,
  textMuted: palette.slate500,
  textFaint: palette.slate400,
  textInverse: palette.white,

  // Deepened ramp: bright volt on paper measures ~1.4:1, unusable as text.
  accent: '#5E8C0B',
  accentSoft: 'rgba(94, 140, 11, 0.12)',
  onAccent: palette.white,
  accentStrong: '#4A7008',

  secondary: palette.sparkDeep,
  secondarySoft: 'rgba(14, 156, 126, 0.12)',
  onSecondary: palette.white,

  tertiary: '#7B4FD1',
  tertiarySoft: 'rgba(123, 79, 209, 0.11)',

  danger: '#D22F2F',
  dangerSoft: 'rgba(210, 47, 47, 0.10)',
  onDanger: palette.white,
  warning: '#A86A00',
  warningSoft: 'rgba(168, 106, 0, 0.12)',
  success: palette.sparkDeep,
  successSoft: 'rgba(14, 156, 126, 0.12)',
  info: palette.azureDeep,
  infoSoft: 'rgba(29, 111, 209, 0.10)',

  border: palette.paper300,
  borderStrong: palette.slate300,
  hairline: palette.paperHairline,
  placeholder: palette.paper200,
  scrim: 'rgba(10, 14, 24, 0.36)',
  focusRing: 'rgba(94, 140, 11, 0.30)',


  chartGrid: 'rgba(10, 14, 24, 0.07)',
  chartAxis: palette.slate400,
  series: ['#5E8C0B', palette.sparkDeep, palette.azureDeep, palette.coralDeep] as [
    string,
    string,
    string,
    string,
  ],
  areaFrom: 'rgba(94, 140, 11, 0.20)',
  areaTo: 'rgba(94, 140, 11, 0)',
} satisfies Theme['colors'];

function buildTheme(mode: ThemeMode, scale = 1): Theme {
  const isDark = mode === 'dark';
  const colors: Theme['colors'] = isDark ? darkColors : lightColors;

  // Light mode gets real, soft elevation; dark mode separates with borders and
  // surface lifts because black-on-black shadows are invisible.
  const shadows: Theme['shadows'] = isDark
    ? {
        none: null,
        card: null,
        raised: null,
        accent: {
          shadowColor: palette.volt,
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      }
    : {
        none: null,
        card: {
          shadowColor: '#1A2233',
          shadowOpacity: 0.07,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        raised: {
          shadowColor: '#141C2C',
          shadowOpacity: 0.13,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 12 },
          elevation: 10,
        },
        accent: {
          shadowColor: '#5E8C0B',
          shadowOpacity: 0.26,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
      };

  return {
    mode,
    // Must match the `backgroundColor` of the matching splash entry in app.json,
    // or the moment the native splash hands over shows a hard colour change. The
    // light value is paper0 rather than ink900 because a dark launch background
    // behind a light app is exactly the flash the field exists to prevent.
    brandBackground: isDark ? palette.ink900 : palette.paper0,
    colors,
    gradients: {
      hero: isDark
        ? [palette.ink600, palette.ink700, palette.ink800]
        : [palette.white, palette.paper0, palette.paper100],
      accent: isDark
        ? [palette.volt, palette.spark]
        : ['#7AB518', palette.sparkDeep],
      surface: isDark
        ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']
        : ['rgba(10,14,24,0.035)', 'rgba(10,14,24,0)'],
      fade: isDark ? ['rgba(0,0,0,0)', 'rgba(0,0,0,1)'] : ['rgba(251,251,248,0)', 'rgba(251,251,248,1)'],
    },
    shadows,
    spacing,
    radius,
    fontSize,
    weight,
    lineHeight,
    motion,
    surfaceSkin: platformSurface,
    scale,
  };
}

const darkTheme = buildTheme('dark');
const lightTheme = buildTheme('light');

/** Scales display type up on tablets so 22pt titles don't look lost at 1024pt. */
function useThemeFor(mode: ThemeMode, longestEdge: number): Theme {
  return useMemo(
    () => buildTheme(mode, longestEdge >= 700 ? 1.08 : 1),
    [mode, longestEdge],
  );
}

export function themeFor(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

/**
 * The theme the app should draw with right now: the user's mode preference
 * (which may be 'system') folded against the OS appearance, with display type
 * scaled for large phones. Re-renders on OS appearance change, on preference
 * change, and on rotation, `useThemeFor` memoises on the longest edge, which
 * rotation does not change, so rotating costs no rebuild.
 */
export function useAppTheme(): Theme {
  const systemDark = useColorScheme() === 'dark';
  const [, resolved] = useThemeMode(systemDark);
  const { width, height } = useWindowDimensions();
  const base = useThemeFor(resolved, Math.max(width, height));
  // The user's accent preference, or `null` for the brand accent.
  const accent = useAccentColors(resolved);
  return useMemo(() => {
    if (accent === null) return base;
    return {
      ...base,
      colors: { ...base.colors, ...accent },
      gradients: { ...base.gradients, accent: [accent.accent, accent.accentStrong] },
      shadows: {
        ...base.shadows,
        accent: base.shadows.accent ? { ...base.shadows.accent, shadowColor: accent.accent } : null,
      },
    };
  }, [accent, base]);
}

/** Status-bar style that keeps contrast against the theme canvas. */
export function statusBarStyle(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'dark' ? 'light' : 'dark';
}

