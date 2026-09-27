/**
 * The flex vocabulary the layout primitives share.
 *
 * `Stack`/`Row` exist so a screen states its arrangement once instead of
 * repeating flexDirection/align/gap triples, and so the gap vocabulary is the
 * spacing scale rather than whatever number looked right. They are plain `View`s
 * with a memoised style: not smart components: because a layout wrapper that
 * subscribes to context is a wrapper that re-renders on a theme change.
 *
 * These take theme *values* as props where a value is data (a card's tone) and
 * use `useAppTheme` where a value is design (a card's radius). The distinction
 * matters for list performance: a row rendered 40 times should not rebuild a
 * theme object 40 times.
 */
import type { ViewStyle } from 'react-native';
import type { spacing } from '@/features/core/theme';

/** A step of the spacing scale: the only gaps and paddings the primitives accept. */
export type SpacingStep = keyof typeof spacing;

/**
 * The alignment vocabulary callers write. `'end'` rather than Yoga's `'flex-end'`
 * because this file exists to speak design language, and because `alignItems` and
 * `alignSelf` disagree about which of the two spellings they accept: normalising
 * here means no component ever has to remember which prop it is on.
 */
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

/** The main-axis vocabulary, in the same design language as {@link Align}. */
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

/** `start` and `end` in Yoga's spelling. */
export function crossAxis(align: Align): NonNullable<ViewStyle['alignItems']> {
  if (align === 'start' || align === 'end') return `flex-${align}`;
  return align;
}

/** `between`, `around` and `evenly` in Yoga's spelling. */
export function mainAxis(justify: Justify): NonNullable<ViewStyle['justifyContent']> {
  if (justify === 'start' || justify === 'end') return `flex-${justify}`;
  if (justify === 'center') return 'center';
  return `space-${justify}`;
}
