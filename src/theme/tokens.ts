/**
 * Raw design tokens. Both palettes are authored independently: the light theme
 * is a warm-paper system with its own accent ramp, not an inversion of dark.
 *
 * Anything a component needs should be reached through the semantic `Theme`
 * built in `theme.ts`, not through these ramps directly.
 */
import { Platform } from 'react-native';

export const palette = {
  // Brand ramp
  volt: '#C6F24E',
  voltDeep: '#8FBF19',
  voltInk: '#1B2405',
  spark: '#35E8C0',
  sparkDeep: '#0E9C7E',
  coral: '#FF6A45',
  coralDeep: '#D6431F',
  azure: '#5AA8FF',
  azureDeep: '#1D6FD1',
  plum: '#B98CFF',

  // Dark surfaces: blue-black ink, lifted with a cool cast rather than grey.
  ink900: '#07090F',
  ink800: '#0B0F18',
  ink700: '#111726',
  ink600: '#182033',
  ink500: '#212C44',
  ink400: '#2C3A57',
  inkHairline: '#212B3F',

  // Light surfaces: warm paper, cool neutral text.
  paper0: '#FBFBF8',
  paper100: '#F4F5F1',
  paper200: '#ECEDe7',
  paper300: '#E0E2DA',
  paperHairline: '#DFE1D8',
  slate900: '#0A0E18',
  slate700: '#2A3346',
  slate500: '#5A6478',
  slate400: '#7C869A',
  slate300: '#A3ABBC',

  white: '#FFFFFF',
  black: '#000000',
} as const;

/** Activity accents: stable across both themes, tuned for legibility per mode. */
export type ActivityTone = 'volt' | 'spark' | 'azure' | 'coral' | 'plum';

/**
 * One family, the full weight ramp. Inter carries everything from 11pt captions
 * to the 58pt hero numeral; hierarchy comes from weight, size and tracking
 * rather than from switching typeface, which is what three families were doing
 * before and why headings and body never quite looked related.
 *
 * `display` is 800 rather than 700 because at 34pt and above a bold that reads
 * strong at 15pt goes soft: the ramp has to keep climbing as the size does.
 *
 * JetBrains Mono survives for exactly one reason: digits that must not reflow
 * as they change (the timer, live pace). Inter's proportional figures make a
 * running clock jitter on every tick.
 */
export const fontFamily = {
  display: 'Inter_800ExtraBold',
  displayMedium: 'Inter_700Bold',
  displaySemiBold: 'Inter_600SemiBold',
  heading: 'Inter_700Bold',
  semibold: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
  mono: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
} as const;


/**
 * The spacing scale.
 *
 * `xxl` and up carry the vertical rhythm BETWEEN sections, and they are generous on purpose:
 * fewer, larger, further-apart elements is what makes a metrics dashboard legible on a phone,
 * and the alternative is a screen that is dense with information and unreadable at a glance.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  xxxl: 36,
  huge: 48,
} as const;

/**
 * The distance from the screen edge to any content, everywhere.
 *
 * One token because it was previously two. Nine screens indented their body by `xl` and seven
 * by `lg`, and the header bar used `lg`, so on those nine the title in the bar and the content
 * under it did not share a left edge. Navigating between two screens shifted everything four
 * points sideways, which is the kind of thing that reads as sloppiness without ever being
 * identifiable as a bug.
 *
 * `xl` won because the wider gutter suits the larger type this app uses for metrics, and
 * because a generous edge is what makes a dense dashboard readable on a phone.
 */
export const screenGutter = 20;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
} as const;

/**
 * How a grouped surface looks on each platform.
 *
 * iOS groups rows into an inset card: the card owns the gutter, rows fill it edge to edge,
 * hairlines separate them and a pressed row highlights. Material uses a tonal surface with
 * a smaller radius, no separators, and a ripple for press feedback; there the scroll
 * container owns the gutter. Screens never branch on the platform for this: `Card` and the
 * row primitives read the skin, so one token set decides it everywhere.
 */
export type PlatformSurface = {
  /** Corner radius of a grouped card. */
  radius: number;
  /** Which theme colour paints the card. */
  surface: 'surface' | 'surfaceRaised';
  /** What sits between two rows inside a card. */
  separator: 'hairline' | 'none';
  /** How a pressed row answers the touch. */
  rowPressed: 'highlight' | 'ripple';
  /** Who holds the horizontal gutter for a list: the card itself, or the scroll container. */
  gutterOwner: 'card' | 'container';
  /** Depth by shadow (iOS) or by tone alone (Material's tonal surfaces carry no shadow). */
  shadow: boolean;
};

const platformSurfaces = {
  ios: {
    radius: radius.lg,
    surface: 'surface',
    separator: 'hairline',
    rowPressed: 'highlight',
    gutterOwner: 'card',
    shadow: true,
  },
  android: {
    radius: radius.md,
    surface: 'surfaceRaised',
    separator: 'none',
    rowPressed: 'ripple',
    gutterOwner: 'container',
    shadow: false,
  },
} as const satisfies Record<'ios' | 'android', PlatformSurface>;

/** The skin for the platform this build runs on. */
export const platformSurface: PlatformSurface =
  Platform.OS === 'android' ? platformSurfaces.android : platformSurfaces.ios;

export const fontSize = {
  micro: 11,
  caption: 12.5,
  label: 13.5,
  body: 15,
  bodyLg: 16.5,
  subhead: 19,
  title: 22,
  headline: 27,
  display: 34,
  hero: 44,
  giant: 58,
} as const;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const touchTarget = 44;

/**
 * Opacity of a disabled control's content: Material 3's disabled-state value. For native
 * Compose content that has no disabled look of its own (a clickable list row's text).
 */
export const disabledContentAlpha = 0.38;

/** Line heights tuned per size so Space Grotesk numerals sit tight and calm. */
export const lineHeight = {
  tight: 1,
  snug: 1.1,
  normal: 1.28,
  relaxed: 1.45,
  loose: 1.62,
} as const;

export const z = {
  card: 1,
  sticky: 10,
  sheet: 50,
  modal: 100,
  toast: 200,
} as const;

export const motion = {
  /** Durations in ms. Short enough to feel responsive, long enough to read. */
  instant: 90,
  fast: 160,
  base: 240,
  slow: 360,
  deliberate: 520,
  /** iOS-style deceleration: arrives quickly, settles softly. */
  standard: [0.32, 0.72, 0, 1] as const,
  emphasized: [0.2, 0, 0, 1] as const,
  spring: { damping: 22, stiffness: 260, mass: 0.9 },
  springSoft: { damping: 26, stiffness: 170, mass: 1 },
} as const;
