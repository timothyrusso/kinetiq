/**
 * Layout primitives.
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
import { memo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme, type Theme } from '@/theme/theme';
import { Txt } from './Text';

type Gap = keyof typeof spacing;

/**
 * The alignment vocabulary callers write. `'end'` rather than Yoga's `'flex-end'`
 * because this file exists to speak design language, and because `alignItems` and
 * `alignSelf` disagree about which of the two spellings they accept: normalising
 * here means no component ever has to remember which prop it is on.
 */
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

function crossAxis(align: Align): NonNullable<ViewStyle['alignItems']> {
  if (align === 'start' || align === 'end') return `flex-${align}`;
  return align;
}

function mainAxis(
  justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly',
): NonNullable<ViewStyle['justifyContent']> {
  if (justify === 'start' || justify === 'end') return `flex-${justify}`;
  if (justify === 'center') return 'center';
  return `space-${justify}`;
}

export type StackProps = {
  gap?: Gap;
  align?: Align;
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  padding?: Gap;
  px?: Gap;
  py?: Gap;
  flex?: number;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export const Stack = memo(function Stack({
  gap,
  align,
  justify,
  padding,
  px,
  py,
  flex,
  fill,
  style,
  children,
}: StackProps) {
  return (
    <View
      style={[
        { flexDirection: 'column' },
        fill && { flex: 1 },
        flex === undefined ? null : { flex },
        gap === undefined ? null : { gap: spacing[gap] },
        align === undefined ? null : { alignItems: crossAxis(align) },
        justify === undefined ? null : { justifyContent: mainAxis(justify) },
        padding === undefined ? null : { padding: spacing[padding] },
        px === undefined ? null : { paddingHorizontal: spacing[px] },
        py === undefined ? null : { paddingVertical: spacing[py] },
        style,
      ]}
    >
      {children}
    </View>
  );
});

export const Row = memo(function Row({
  gap,
  align = 'center',
  justify,
  wrap,
  flex,
  fill,
  style,
  children,
}: Omit<StackProps, 'padding' | 'px' | 'py'> & { wrap?: boolean }) {
  return (
    <View
      style={[
        { flexDirection: 'row' },
        fill && { flex: 1 },
        flex === undefined ? null : { flex },
        gap === undefined ? null : { gap: spacing[gap] },
        align === undefined ? null : { alignItems: crossAxis(align) },
        justify === undefined ? null : { justifyContent: mainAxis(justify) },
        wrap ? { flexWrap: 'wrap' } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
});

/** Pushes everything after it to the far edge, `flex: 1` under a clearer name. */
export const Spacer = memo(function Spacer() {
  return <View style={{ flex: 1 }} />;
});

/**
 * Fixed pixel gap. Prefer `Stack gap`; this exists for the case where a gap has
 * to be a specific number because something else measures it, e.g. the inset
 * that matches a chart's axis width.
 */
export const Gap = memo(function Gap({ size }: { size: number }) {
  return <View style={{ width: size, height: size }} />;
});

export const Divider = memo(function Divider({
  inset = 0,
  color,
}: {
  inset?: number;
  color?: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: color ?? theme.colors.hairline,
        marginHorizontal: inset,
      }}
    />
  );
});
/**
 * Hairlines are a classic mobile bug: a hard 0.5 is correct on a 2x screen and
 * invisible on a 1x one. `StyleSheet.hairlineWidth` is the platform's own answer,
 * and it is a device constant rather than theme state: hence a module-level
 * read rather than a hook.
 */

/**
 * The card. `tone` is the only intentional surface variation: `sunken` reads as
 * a value inside a container, `accent` as something the user should act on.
 * Shadows are declared for both platforms (elevation on Android) because the
 * alternative: no depth on Android: makes the light theme look unfinished.
 */
export const Card = memo(function Card({
  children,
  onPress,
  tone = 'raised',
  padding = 'lg',
  style,
  onLongPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  tone?: CardTone;
  padding?: Gap;
  style?: StyleProp<ViewStyle>;
  onLongPress?: (e: GestureResponderEvent) => void;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const surface = cardSurface(theme, tone);
  const interactive = Boolean(onPress || onLongPress);

  // The platform skin decides radius, colour, hairline and depth: an inset-grouped card on
  // iOS, a Material tonal surface on Android. Screens never branch on this themselves.
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: surface.background,
      borderRadius: theme.surfaceSkin.radius,
      padding: spacing[padding],
      borderWidth: surface.border,
      borderColor: surface.borderColor,
      overflow: 'hidden',
    },
    tone === 'raised' && theme.surfaceSkin.shadow ? theme.shadows.card : null,
    style,
  ];

  if (!interactive) return <View style={base}>{children}</View>;

  // Pressed feedback is a `Pressable` style function, so the scale happens on the
  // native prop path on press rather than by re-rendering the card's subtree.
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      {...(accessibilityLabel ? { accessibilityLabel } : null)}
      style={({ pressed }) => [
        base,
        pressed ? { opacity: 0.85, transform: [{ scale: 0.994 }] } : null,
      ]}
    >
      {children}
    </Pressable>
  );
});

type CardTone = 'flat' | 'raised' | 'sunken' | 'accent' | 'outline';

function cardSurface(
  theme: Theme,
  tone: CardTone,
): { background: string; border: number; borderColor: string } {
  switch (tone) {
    case 'flat':
      return { background: theme.colors[theme.surfaceSkin.surface], border: 0, borderColor: 'transparent' };
    case 'raised':
      return {
        background: theme.colors[theme.surfaceSkin.surface],
        border: theme.surfaceSkin.separator === 'hairline' ? 1 : 0,
        borderColor: theme.colors.hairline,
      };
    case 'sunken':
      // The canvas colour is the *recessed* tone in both palettes: darker ink in
      // dark mode, warmer paper in light. It is a different token from
      // `background` precisely so the two can be tuned apart.
      return { background: theme.colors.canvas, border: 1, borderColor: theme.colors.hairline };
    case 'accent':
      return { background: theme.colors.accentSoft, border: 1, borderColor: theme.colors.accent };
    case 'outline':
      return { background: 'transparent', border: 1, borderColor: theme.colors.border };
  }
}

/**
 * Frosted (iOS) or solid (Android) backing for anything that floats over scrolling
 * content: the tab bar, the workout footer.
 *
 * It has to be a **sibling** of the content rather than its parent, because a blur
 * surface that *contains* children re-blurs on every child update: which is exactly
 * the press feedback that needs to stay cheap. So a caller puts this first inside an
 * absolutely positioned container and lets its own children sit on top.
 *
 * The translucent `overlay` colour on its own is not enough: 86% alpha over a light
 * list still shows the rows underneath as ghosts, which on the workout screen read as
 * set rows duplicated behind the Finish button. The blur is what makes it a surface.
 */
export const OverlaySurface = memo(function OverlaySurface({
  theme,
  edge = 'top',
}: {
  theme: Theme;
  /** Which edge the hairline goes on: the side that meets the content. */
  edge?: 'top' | 'bottom';
}) {
  // Written as a conditional rather than a computed key: an object with a computed
  // key widens to an index signature, which no longer type-checks against `ViewStyle`.
  const hairline = (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(edge === 'top' ? { top: 0 } : { bottom: 0 }),
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.overlayBorder,
      }}
    />
  );
  // Liquid Glass, where the OS has it (iOS 26+). This is the real system material: it
  // refracts and specularly highlights the content scrolling under it, which a blur cannot
  // do: so it gets NO opaque base: an opaque layer underneath would be the one thing that
  // defeats it. No hairline either; the material carries its own edge, and Apple's own glass
  // bars do not draw one.
  //
  // `colorScheme` is passed explicitly rather than left on `auto` because this app has its
  // own light/dark/system setting: on `auto` the glass follows the OS while the app follows
  // the user, and the bar ends up light under a dark app.
  if (liquidGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={theme.mode === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  const base = (
    // An opaque base first, so the bar is never transparent to the content behind it
    // even if the material fails to initialise.
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]} />
  );
  if (Platform.OS !== 'ios') {
    return (
      <>
        {base}
        {hairline}
      </>
    );
  }
  return (
    <>
      {base}
      <BlurView
        // The material the real iOS bar uses, so this matches the nav bar above it.
        tint={theme.mode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        intensity={theme.mode === 'dark' ? 68 : 80}
        style={StyleSheet.absoluteFill}
      />
      {hairline}
    </>
  );
});

/**
 * Is Liquid Glass available on this device?
 *
 * Resolved once, lazily: not at module scope. This module is imported by the tab bar, which
 * is on the first frame, and asking a native module a question before it has registered
 * answers wrong rather than throwing. Cached because the answer cannot change at runtime.
 */
let liquidGlassCache: boolean | null = null;
function liquidGlass(): boolean {
  if (liquidGlassCache === null) {
    try {
      liquidGlassCache = isLiquidGlassAvailable();
    } catch {
      liquidGlassCache = false;
    }
  }
  return liquidGlassCache;
}

/** 2/3/4-up metric grid. `columns` is explicit because a grid that reflows
 * unpredictably makes a dashboard impossible to scan by eye position. */
export const MetricGrid = memo(function MetricGrid({
  children,
  columns = 2,
}: {
  children: ReactNode[];
  columns?: 2 | 3 | 4;
}) {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += columns) {
    rows.push(children.slice(i, i + columns));
  }
  return (
    <Stack gap="md">
      {rows.map((row, i) => (
        <Row key={i} gap="md">
          {row.map((cell, j) => (
            <View key={j} style={{ flex: 1, minWidth: 0 }}>
              {cell}
            </View>
          ))}
          {/* Padding cells keep the last row's columns aligned with the others;
              without them a 3-in-2 grid left-aligns its orphan at full width. */}
          {row.length < columns
            ? Array.from({ length: columns - row.length }, (_, k) => (
                <View key={`pad-${k}`} style={{ flex: 1 }} />
              ))
            : null}
        </Row>
      ))}
    </Stack>
  );
});

/** Pill badge for a status: PR, PB, seeded, set complete. */
export const Badge = memo(function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';
  icon?: ReactNode;
}) {
  const theme = useAppTheme();
  const palette = badgePalette(theme, tone);
  return (
    <Row
      gap="xs"
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.background,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}
    >
      {icon}
      <Txt
        variant="micro"
        weight="bold"
        uppercase
        tracking={0.5}
        color={palette.text}
      >
        {label}
      </Txt>
    </Row>
  );
});

function badgePalette(
  theme: Theme,
  tone: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info',
) {
  switch (tone) {
    case 'neutral':
      return { background: theme.colors.placeholder, text: theme.colors.textMuted };
    case 'accent':
      return { background: theme.colors.accentSoft, text: theme.colors.accent };
    case 'success':
      return { background: theme.colors.successSoft, text: theme.colors.success };
    case 'danger':
      return { background: theme.colors.dangerSoft, text: theme.colors.danger };
    case 'warning':
      return { background: theme.colors.warningSoft, text: theme.colors.warning };
    case 'info':
      return { background: theme.colors.infoSoft, text: theme.colors.info };
  }
}

/**
 * Keyboard-avoiding wrapper for forms. iOS pads; Android's window already resizes for the
 * keyboard (`adjustResize`), and padding there too would lift the form twice.
 */
export function KeyboardAvoid({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={style}>
      {children}
    </KeyboardAvoidingView>
  );
}
