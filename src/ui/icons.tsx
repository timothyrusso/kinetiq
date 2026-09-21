/**
 * The icon set: 24×24 stroke glyphs, authored for this app.
 *
 * Drawn as path data rather than a font or a third-party set for three reasons.
 * A custom font would add an asset and a layout pass to every label; a
 * third-party set would make the app's visual identity someone else's; and paths
 * in a `Path` element inherit `stroke` from the theme, so an icon is recoloured
 * by the same `theme.colors.textMuted` that recolours its label, with no
 * duplicated palette.
 *
 * Every glyph shares a 2-unit visual grid, a 1.75 stroke and round caps, which is
 * what makes a mixed row of them (a run next to a clock next to a flame) read as
 * one family. `size` scales the whole path layer uniformly; `strokeWidth` only
 * changes for the two places that need emphasis (an active tab).
 */
import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, type SvgProps } from 'react-native-svg';
import { radius } from '@/theme/tokens';

/**
 * Each entry is one or more path `d` strings drawn on a 24 grid. Sub-arrays are
 * closed shapes filled instead of stroked, used only where a solid mark is the
 * right read (the filled star of a PR, the dot of a live recording).
 */
const GLYPHS = {
  home: ['M4 10.6 12 4l8 6.6', 'M6 10v9.2h12V10', 'M10 19.2v-5h4v5'],
  activities: [
    'M3 12.6h3.4L9 6.4l3.3 11.4 2.4-5.2H21',
  ],
  workout: [
    'M4.5 9.2v5.6', 'M7.4 7v10', 'M16.6 7v10', 'M19.5 9.2v5.6', 'M7.4 12h9.2',
  ],
  library: [
    'M4.6 4.6h5.2v5.2H4.6z', 'M14.2 4.6h5.2v5.2h-5.2z',
    'M4.6 14.2h5.2v5.2H4.6z', 'M14.2 14.2h5.2v5.2h-5.2z',
  ],
  profile: ['M12 11.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z', 'M5.4 19.4c.9-3.2 3.5-4.8 6.6-4.8s5.7 1.6 6.6 4.8'],

  search: ['M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6z', 'M15.8 15.8 20 20'],
  filter: ['M4.4 7.2h15.2', 'M7.4 12h9.2', 'M10.4 16.8h3.2'],
  sort: ['M6.4 5.6v12.8', 'M6.4 18.4 3.8 15.6', 'M6.4 18.4l2.6-2.8', 'M13 7.4h7', 'M13 12h5', 'M13 16.6h3'],
  close: ['M6.6 6.6 17.4 17.4', 'M17.4 6.6 6.6 17.4'],
  chevronRight: ['M9.6 5.8 16.2 12l-6.6 6.2'],
  chevronDown: ['M5.8 9.4 12 16l6.2-6.6'],
  chevronUp: ['M5.8 14.6 12 8l6.2 6.6'],
  arrowLeft: ['M19 12H5.6', 'M11 5.6 4.8 12l6.2 6.4'],
  arrowUpRight: ['M7.4 16.6 16.6 7.4', 'M9.6 7.4h7v7'],
  plus: ['M12 5.4v13.2', 'M5.4 12h13.2'],
  minus: ['M5.4 12h13.2'],
  check: ['M5.4 12.6 9.8 17l8.8-9.6'],
  checkCircle: ['M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8z', 'M8.2 12.2 11 15l4.8-5.4'],
  play: ['M8.4 5.6 18.4 12l-10 6.4z'],
  pause: ['M9.2 6v12', 'M14.8 6v12'],
  stop: ['M7.2 7.2h9.6v9.6H7.2z'],
  refresh: ['M19.2 12a7.2 7.2 0 1 1-2.4-5.4', 'M19.2 5v4.2H15'],
  trash: ['M6.4 8.4h11.2', 'M9.4 8.4V6.2h5.2v2.2', 'M7.6 8.4l.9 10.4h7l.9-10.4', 'M10.6 11.4v4.6', 'M13.4 11.4v4.6'],
  copy: ['M9 9h9.4v11H9z', 'M15 9V5.6H5.6V15H9'],
  drag: ['M9.4 7.2h.01', 'M14.6 7.2h.01', 'M9.4 12h.01', 'M14.6 12h.01', 'M9.4 16.8h.01', 'M14.6 16.8h.01'],
  grip: ['M8.6 9.4h6.8', 'M8.6 14.6h6.8'],
  more: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  edit: ['M15.6 5.4 18.6 8.4', 'M6.4 18.6l-.6 3 3-.6L17.4 12l-2.4-2.4z'],
  settings: [
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    'M12 3.6l1.4 2.2 2.6-.6.4 2.6 2.2 1.4-1.4 2.2 1.4 2.2-2.2 1.4-.4 2.6-2.6-.6L12 20.4l-1.4-2.2-2.6.6-.4-2.6L5.4 14.6l1.4-2.2-1.4-2.2 2.2-1.4.4-2.6 2.6.6z',
  ],
  bell: ['M8.2 9.6a3.8 3.8 0 0 1 7.6 0c0 4 1.4 5.4 1.4 5.4H6.8s1.4-1.4 1.4-5.4z', 'M10.6 18.2a1.6 1.6 0 0 0 2.8 0'],
  clock: ['M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8z', 'M12 7.8V12l3 2'],
  timer: ['M12 20.4a7.4 7.4 0 1 0 0-14.8 7.4 7.4 0 0 0 0 14.8z', 'M12 9.8V13l2.4 1.6', 'M9.6 3.6h4.8'],
  flame: ['M12 20.4c3 0 5-2 5-4.6 0-3.6-3.6-4.6-3-9.2-2.6 1-4.4 3.6-4.4 6 0 1.2-1 1.6-1.6.8-.4-.6-.6-1.4-.6-2.2-1 1.4-1.4 3-1.4 4.6 0 2.6 2 4.6 6 4.6z'],
  route: [
    'M7.4 8.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
    'M16.6 20.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
    'M7.4 8.4v2.2c0 2.4 2 3.4 4.4 3.8s4.8 1.4 4.8 3.8',
  ],
  mapPin: ['M12 20.4s5.4-5 5.4-9a5.4 5.4 0 1 0-10.8 0c0 4 5.4 9 5.4 9z', 'M12 13.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  mountain: ['M3.4 18.4 9 9.6l3.4 5.2 2-2.8 6.2 6.4z', 'M9 9.6l2.2 3.4'],
  heart: ['M12 19.4S5 15.2 5 10.4a3.9 3.9 0 0 1 7-2.4 3.9 3.9 0 0 1 7 2.4c0 4.8-7 9-7 9z'],
  bolt: ['M13.6 3.6 6.4 13.4h4.6l-1 7 7.4-10h-4.6z'],
  target: ['M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8z', 'M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4z', 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  calendar: ['M5.4 7.6h13.2v11.4H5.4z', 'M5.4 11.2h13.2', 'M9 5v3.4', 'M15 5v3.4'],
  trendUp: ['M4.4 16.4 9.6 11l3 3 6.8-7', 'M14.4 7h5v5'],
  trophy: ['M8.4 5.4h7.2v3.4a3.6 3.6 0 0 1-7.2 0z', 'M8.4 6.6H6v1.6a2.4 2.4 0 0 0 2.4 2.4', 'M15.6 6.6H18v1.6a2.4 2.4 0 0 1-2.4 2.4', 'M12 12.4v3.4', 'M9 18.6h6'],
  offline: ['M4.4 4.4 19.6 19.6', 'M8.2 9.4A7.6 7.6 0 0 1 12 8.2c3.2 0 5.8 1.6 7.2 3.6', 'M5.6 12.4A9.9 9.9 0 0 1 7.6 10.6', 'M9.6 15.2a5 5 0 0 1 5.2-.6', 'M12 18.6h.01'],
  image: ['M4.6 5.6h14.8v12.8H4.6z', 'M4.6 15.4l4.2-4 3.2 3 3-2.6 4.4 3.6', 'M9 9.8a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z'],
  info: ['M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8z', 'M12 11v6', 'M12 8.2h.01'],
  warning: ['M12 4.4 21 19.6H3z', 'M12 10v4.4', 'M12 17h.01'],
  lock: ['M7.4 11h9.2v8.4H7.4z', 'M9.6 11V8.4a2.4 2.4 0 0 1 4.8 0V11'],
  download: ['M12 4.6v9.8', 'M8.4 11.4 12 15l3.6-3.6', 'M5.4 19.4h13.2'],
  eye: ['M12 5.6c4.6 0 8 6.4 8 6.4s-3.4 6.4-8 6.4-8-6.4-8-6.4 3.4-6.4 8-6.4z', 'M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'],
  skip: ['M6.4 6.4 13 12l-6.6 5.6z', 'M17 6.4v11.2'],
  listAdd: ['M4.6 7.4h9', 'M4.6 12h9', 'M4.6 16.6h6', 'M17.4 9.4v8', 'M13.4 13.4h8'],
  layers: ['M12 4.4 20.4 9 12 13.6 3.6 9z', 'M3.6 13.4 12 18l8.4-4.6'],
  ruler: ['M4.4 14.2 14.2 4.4l5.4 5.4L9.8 19.6z', 'M8.2 10.4l1.8 1.8', 'M11 7.6l1.8 1.8', 'M5.6 12.8l1.8 1.8'],
  scale: ['M12 5.4v13.2', 'M6 8.4h12', 'M4 15.4a2.4 2.4 0 0 0 4.8 0L6.4 9z', 'M15.2 15.4a2.4 2.4 0 0 0 4.8 0L17.6 9z'],
  run: ['M15.4 8.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z', 'M14.6 10.2 11 12l1.8 3.4-1.6 4.6', 'M12.8 11.2l3.4 1.6 1.6 2.6', 'M6.4 12.4l2.6-1.4', 'M7.4 8.6 4.8 9.8'],
  bike: ['M7 18.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z', 'M17 18.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z', 'M7 15h5l2.6-5.4', 'M13.4 12l-3.6-3.4H8', 'M16.4 9.6h2.4'],
  walk: ['M13.4 7.8a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z', 'M12.6 10.4 10 12.2l.6 3.6-1.4 4.2', 'M12.8 11.6l2.8 2 .8 3.4', 'M8.6 11 6.4 9.6'],
  yoga: ['M12 7.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z', 'M12 9.4v4.6', 'M12 14l-3.4 4.6', 'M12 14l3.4 4.6', 'M7.6 11.6 12 10l4.4 1.6'],
  dumbbell: ['M4.6 10.4v3.2', 'M7.4 8v8', 'M16.6 8v8', 'M19.4 10.4v3.2', 'M7.4 12h9.2'],
  share: ['M12 15.4V4.6', 'M8.6 8 12 4.6 15.4 8', 'M5.4 13.4v5.6h13.2v-5.6'],
  link: ['M10 13.8a3.4 3.4 0 0 0 4.8 0l2.6-2.6a3.4 3.4 0 0 0-4.8-4.8l-1.2 1.2', 'M14 10.2a3.4 3.4 0 0 0-4.8 0L6.6 12.8a3.4 3.4 0 0 0 4.8 4.8l1.2-1.2'],
  star: ['M12 4.6l2.3 4.8 5.1.7-3.7 3.6.9 5.1-4.6-2.5-4.6 2.5.9-5.1L4.6 10.1l5.1-.7z'],
} as const;

export type IconName = keyof typeof GLYPHS;

export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

export type IconProps = {
  name: IconName;
  /** Square size in points. Optical alignment is handled by the caller's gap. */
  size?: number;
  color: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Accessible label. A decorative icon beside a text label must leave this
   * undefined, or VoiceOver reads "run, Run": the icon is the label's
   * decoration, not a second copy of its content.
   */
  accessibilityLabel?: string;
};

export const Icon = memo(function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 1.75,
  style,
  accessibilityLabel,
}: IconProps) {
  const paths = GLYPHS[name];
  // Memoised so the prop object is stable: an icon in a 40-row list should not
  // hand `Svg` a fresh object every render.
  const svgProps = useMemo<SvgProps>(
    () => ({
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      // Unt labelled icons stay out of the accessibility tree entirely, which is
      // what makes them decoration rather than a second reading of the label.
      ...(accessibilityLabel
        ? { accessible: true, role: 'img' as const, accessibilityLabel }
        : {}),
    }),
    [accessibilityLabel, size],
  );

  return (
    <Svg {...svgProps} style={style}>
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
});

/** Filled dot, for "recording" and unread indicators, sized against the icon grid. */
export const IconDot = memo(function IconDot({
  size = 8,
  color,
}: {
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 8 8" aria-hidden focusable={false}>
      <Circle cx={4} cy={4} r={4} fill={color} />
    </Svg>
  );
});

/**
 * Rounded swatch behind a list-row icon: the visual rhythm of the app.
 *
 * Deliberately a plain `View` rather than an SVG rect: the tile has to clip
 * nothing and layer one child, so drawing it in SVG would cost a raster surface
 * per row in a list that may show thirty of them at once. No theme hook here
 * either, `radius.md` is a constant, and subscribing a row icon to the theme
 * context would re-render it on an appearance change for a corner it already has.
 */
export const IconTile = memo(function IconTile({
  name,
  color,
  background,
  size = 38,
  strokeWidth,
}: {
  name: IconName;
  color: string;
  background: string;
  size?: number;
  strokeWidth?: number;
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
      <Icon name={name} size={Math.round(size * 0.5)} color={color} strokeWidth={strokeWidth} />
    </View>
  );
});
