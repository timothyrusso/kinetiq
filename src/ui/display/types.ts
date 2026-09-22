/**
 * The structured shapes metadata travels in.
 *
 * A row used to receive "52 min · 5:58 /km · 412 kcal" as one string. That string could not be
 * given icons, could not wrap between items instead of mid-item, and could not be read by a
 * screen reader as three facts rather than one sentence with odd punctuation. These types are
 * the replacement: every piece of metadata is an item, and the display primitives decide how
 * items look.
 */
import type { ActivityKind } from '@/domain/types';
import type { IconName } from '@/ui/icons';

/** One fact beside an icon: "52 min" with a clock. */
export type MetaItem = {
  icon: IconName;
  label: string;
  /** What a screen reader says instead of `label`, when the visible form is terse ("5:58 /km"). */
  a11y?: string;
};

/** A colour family for a tag. Activity kinds are tones, so a run tag is the run colour. */
export type Tone = 'neutral' | 'accent' | ActivityKind;

/** One chip of taxonomy: a muscle, a piece of equipment, an activity kind. */
export type Tag = {
  key: string;
  label: string;
  tone?: Tone;
  onPress?: () => void;
};

export type Trend = {
  /** Already formatted, sign included: "+12%". */
  delta: string;
  direction: 'up' | 'down' | 'flat';
};
