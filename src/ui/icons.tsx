/**
 * The icon set: Ionicons, by way of `@expo/vector-icons`.
 *
 * This file used to hold 62 hand-authored SVG glyphs. They were consistent with each other and
 * with nothing else, which is the problem: an app whose icons are drawn in-house looks
 * hand-drawn next to the platform's own, and every new icon is a drawing task. Ionicons ships
 * with Expo, is maintained, and has 1357 glyphs, so a missing icon is a lookup rather than a
 * bezier.
 *
 * Where a platform-native symbol is actually available, it is used instead of this file: Expo UI
 * components take `sf` (SF Symbols) and `md` (Material Symbols) directly, which is what the tab
 * bar does. Those APIs only exist inside Expo UI's SwiftUI and Compose hosts, so everything
 * drawn in React Native, which is most of the app, comes from here.
 *
 * ## The name map is the point
 *
 * Call sites keep saying `<Icon name="flame" />`. The app's own vocabulary survives: an icon is
 * named for what it means here (`route`, `streak`, `offline`), not for what the icon set happens
 * to call it. That keeps 87 call sites out of this change, and means swapping icon sets again is
 * an edit to one table.
 *
 * ## Sizes
 *
 * `ICON_SIZE` exists because the app had a 20pt glyph in one header button and a 22pt glyph in
 * the button beside it. Sizes come from here now, not from each caller's judgement.
 */
import { memo } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { radius } from '@/theme/tokens';

/**
 * This app's icon vocabulary, mapped to Ionicons glyph names.
 *
 * Every value is checked against the real glyph map, not guessed. Two pairs are worth a note:
 * `run` uses `walk` and `walk` uses `footsteps`, because Ionicons has no running figure and
 * those two read correctly side by side in an activity list; `yoga` uses `body`, which is the
 * closest the set offers.
 */
const GLYPHS = {
  // Navigation
  home: 'home',
  activities: 'pulse',
  workout: 'barbell',
  library: 'grid',
  profile: 'person',

  // Actions and affordances
  search: 'search',
  filter: 'filter',
  sort: 'swap-vertical',
  close: 'close',
  chevronRight: 'chevron-forward',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  arrowLeft: 'arrow-back',
  arrowUpRight: 'arrow-forward',
  plus: 'add',
  minus: 'remove',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  play: 'play',
  pause: 'pause',
  stop: 'stop',
  refresh: 'refresh',
  trash: 'trash',
  copy: 'copy',
  more: 'ellipsis-horizontal',
  edit: 'create',
  settings: 'settings',
  share: 'share-social',
  link: 'link',
  download: 'download',
  eye: 'eye',
  listAdd: 'list',
  layers: 'layers',
  drag: 'reorder-three',

  // Training and metrics
  bell: 'notifications',
  clock: 'time',
  timer: 'timer',
  flame: 'flame',
  route: 'navigate',
  mapPin: 'location',
  bolt: 'flash',
  target: 'disc',
  calendar: 'calendar',
  trendUp: 'trending-up',
  trophy: 'trophy',
  heart: 'heart',
  scale: 'speedometer',
  ruler: 'resize',

  // Activity kinds
  run: 'walk',
  walk: 'footsteps',
  bike: 'bicycle',
  yoga: 'body',
  dumbbell: 'barbell',
  mountain: 'triangle',
  skip: 'play-skip-forward',
  star: 'star',

  // States
  offline: 'cloud-offline',
  image: 'image',
  info: 'information-circle',
  warning: 'warning',
  lock: 'lock-closed',
} as const;

export type IconName = keyof typeof GLYPHS;

export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

/**
 * The only icon sizes this app uses.
 *
 * Named by role rather than by number so a caller picks a meaning: an icon inside a row is
 * `inline`, an icon that is itself the control is `action`. Before this, identical-looking
 * buttons carried 20pt and 22pt glyphs depending on which component drew them.
 */
export const ICON_SIZE = {
  /** Beside caption text, inside a chip or a badge. */
  micro: 14,
  /** Beside body text, inside a list row. */
  inline: 18,
  /** The default: a glyph that is the visible content of a small control. */
  action: 22,
  /** A tab bar item, an empty-state mark. */
  large: 28,
} as const;

export type IconProps = {
  name: IconName;
  /** Square size in points. Prefer a value from `ICON_SIZE`. */
  size?: number;
  color: string;
  /**
   * Use the solid variant. Outline is the default because it matches the weight of this app's
   * type and of SF Symbols at their default weight; solid reads as emphasis, which is what a
   * selected state or a completed set wants. Every glyph in the map has both.
   */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Accessible label. A decorative icon beside a text label must leave this undefined, or
   * VoiceOver reads "run, Run": the icon is the label's decoration, not a second copy of its
   * content.
   */
  accessibilityLabel?: string;
};

export const Icon = memo(function Icon({
  name,
  size = ICON_SIZE.action,
  color,
  filled = false,
  style,
  accessibilityLabel,
}: IconProps) {
  return (
    <Ionicons
      name={filled ? GLYPHS[name] : (`${GLYPHS[name]}-outline` as typeof GLYPHS[IconName])}
      size={size}
      color={color}
      // An icon font renders as text, so it inherits text style. The cast is the narrowest way
      // to say that: `Ionicons` types its style as a TextStyle and callers pass layout props.
      style={style as StyleProp<TextStyle>}
      // Unlabelled icons stay out of the accessibility tree entirely, which is what makes them
      // decoration rather than a second reading of the label they sit beside.
      {...(accessibilityLabel
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
        : { accessible: false, importantForAccessibility: 'no' as const })}
    />
  );
});

/** Filled dot, for "recording" and unread indicators. */
export const IconDot = memo(function IconDot({
  size = 8,
  color,
}: {
  size?: number;
  color: string;
}) {
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
});

/**
 * Rounded swatch behind a list-row icon: the visual rhythm of the app.
 *
 * A plain `View` rather than anything drawn: the tile clips nothing and layers one child, so a
 * raster surface per row would be waste in a list that shows thirty at once. No theme hook
 * either, `radius.md` is a constant, and subscribing a row icon to the theme context would
 * re-render it on an appearance change for a corner it already has.
 */
export const IconTile = memo(function IconTile({
  name,
  color,
  background,
  size = 38,
}: {
  name: IconName;
  color: string;
  background: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
});
