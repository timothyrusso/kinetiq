/**
 * Text primitives.
 *
 * Every string in the app renders through `Txt` with a `variant`, and no screen
 * picks a font size by hand. That is not ceremony: the difference between an
 * instrument panel and a pile of labels is that the numbers, the units and the
 * captions have one fixed relationship to each other, and the moment a screen
 * freehands `fontSize: 17` the hierarchy starts to drift screen by screen.
 *
 * `variant` chooses weight, size, line height and tracking together, because
 * those four are only correct as a set, Inter at 34 needs tighter leading AND
 * negative tracking, while the same face at 11 needs neither; separating them
 * guarantees someone gets one of the four wrong.
 */
import { memo } from 'react';
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { fontFamily } from '@/theme/tokens';
import { useAppTheme, type Theme } from '@/theme/theme';

/**
 * The scale. Every row carries its own `track` (letter-spacing in points),
 * because Inter is drawn loose enough to survive an 11pt caption and that same
 * spacing reads slack at 44pt. Tracking tightens as size climbs and opens
 * slightly below 13pt: the correction the family is designed to want, and the
 * difference between "uses Inter" and "set in Inter".
 *
 * `mono` rows are never tracked: fixed-width digits exist so a ticking value
 * does not move, and letter-spacing would reintroduce exactly that shift.
 */
const VARIANTS = {
  giant: { family: fontFamily.display, size: 58, line: 1.02, track: -1.8 },
  hero: { family: fontFamily.display, size: 44, line: 1.04, track: -1.2 },
  display: { family: fontFamily.display, size: 34, line: 1.08, track: -0.9 },
  headline: { family: fontFamily.display, size: 27, line: 1.12, track: -0.6 },
  title: { family: fontFamily.heading, size: 22, line: 1.2, track: -0.4 },
  subhead: { family: fontFamily.heading, size: 19, line: 1.24, track: -0.2 },

  body: { family: fontFamily.regular, size: 15, line: 1.45, track: 0 },
  bodyLg: { family: fontFamily.regular, size: 16.5, line: 1.45, track: -0.1 },
  strong: { family: fontFamily.semibold, size: 15, line: 1.35, track: 0 },
  label: { family: fontFamily.medium, size: 13.5, line: 1.3, track: 0 },
  caption: { family: fontFamily.medium, size: 12.5, line: 1.3, track: 0.1 },
  micro: { family: fontFamily.semibold, size: 11, line: 1.28, track: 0.2 },

  /**
   * Big readouts: distance, volume, time.
   *
   * Deliberately larger than the reading scale by a wide margin. A training app is looked at
   * between sets, at arm's length, and the number is the whole point of the screen; the label
   * beside it is there to say what the number means and can afford to be small. This is the
   * single biggest lever on whether a dashboard reads as an instrument or as a form.
   */
  numeral: { family: fontFamily.display, size: 34, line: 1.0, track: -1 },
  numeralLg: { family: fontFamily.display, size: 46, line: 0.98, track: -1.4 },
  numeralSm: { family: fontFamily.displayMedium, size: 21, line: 1.1, track: -0.35 },
  /** Values that tick: the timer, live pace. Fixed-width digits, no reflow. */
  mono: { family: fontFamily.monoSemiBold, size: 16, line: 1.2, track: 0 },
  monoLg: { family: fontFamily.monoSemiBold, size: 26, line: 1.06, track: 0 },
  monoSm: { family: fontFamily.mono, size: 12.5, line: 1.25, track: 0 },
} as const;

export type TxtVariant = keyof typeof VARIANTS;

/**
 * Token accessors for surfaces that must match this scale but cannot render `Txt`.
 * List rows are the case: they need identical typography without a theme-context
 * subscription, so they read the numbers here instead of freehanding a size.
 */
export function fontSizeOf(variant: TxtVariant): number {
  return VARIANTS[variant].size;
}

export function lineHeightOf(variant: TxtVariant): number {
  return VARIANTS[variant].line;
}

export function fontFamilyOf(variant: TxtVariant): string {
  return VARIANTS[variant].family;
}

/** Semantic colours, so a screen says *why* something is muted, not which hex. */
type TxtTone =
  | 'default'
  | 'muted'
  | 'faint'
  | 'inverse'
  | 'accent'
  | 'secondary'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info';

function toneColor(theme: Theme, tone: TxtTone): string {
  switch (tone) {
    case 'default':
      return theme.colors.text;
    case 'muted':
      return theme.colors.textMuted;
    case 'faint':
      return theme.colors.textFaint;
    case 'inverse':
      return theme.colors.textInverse;
    case 'accent':
      return theme.colors.accent;
    case 'secondary':
      return theme.colors.secondary;
    case 'danger':
      return theme.colors.danger;
    case 'warning':
      return theme.colors.warning;
    case 'success':
      return theme.colors.success;
    case 'info':
      return theme.colors.info;
  }
}

export type TxtProps = Omit<TextProps, 'style'> & {
  variant?: TxtVariant;
  tone?: TxtTone;
  /** Overrides the tone. For a colour that is data, e.g. an activity's tone. */
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  /** Letter-spacing in em-scaled points; `tracking` is for all-caps labels. */
  tracking?: number;
  uppercase?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
};

export const Txt = memo(function Txt({
  variant = 'body',
  tone = 'default',
  color,
  align,
  weight,
  tracking,
  uppercase,
  style,
  ...rest
}: TxtProps) {
  const theme = useAppTheme();
  const spec = VARIANTS[variant];
  const scaled = theme.scale === 1 ? spec.size : Math.round(spec.size * theme.scale);

  const combined = [
    {
      fontFamily: spec.family,
      fontSize: scaled,
      lineHeight: Math.round(scaled * spec.line),
      // Text renderers round line heights inconsistently if they are fractional,
      // which shows up as a two-line caption sitting 1px off its neighbours.
      color: color ?? toneColor(theme, tone),
      ...(align ? { textAlign: align } : null),
      ...(weight ? { fontWeight: weight } : null),
      // The variant's optical tracking, unless the caller overrides it: which all-caps
      // labels do, since capitals need opening up where lowercase needs tightening.
      letterSpacing: tracking ?? spec.track,
      ...(uppercase ? { textTransform: 'uppercase' as const } : null),
    },
    style,
  ] as StyleProp<TextStyle>;

  return <RNText {...rest} style={combined} />;
});

/** A label pair: the small caption above a value. The atom of every metric. */
export function MetricLabel({
  label,
  style,
}: {
  label: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Txt variant="micro" tone="faint" uppercase tracking={0.7} style={style}>
      {label}
    </Txt>
  );
}
