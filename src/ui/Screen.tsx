/**
 * Screen scaffold: safe-area container, nav bar, collapsing large title.
 *
 * ## Two header forms, on purpose
 *
 * A pushed detail screen wants a compact bar immediately — the user is deep in a stack and
 * needs the back affordance and the title on frame one. A root tab wants a large title that
 * collapses as content scrolls under it, which is the native reading of "you are at the top
 * level". Rendering one header for both makes either case feel like the wrong kind of screen.
 *
 * ## Why the header is a hook plus two parts, not a wrapping component
 *
 * A scroll handler has to be attached to the *same* scroll view the list renders, and a
 * wrapper component cannot reach inside a `FlashList` the caller owns. So the pattern is:
 * the screen calls `useScreenHeaderScroll()`, spreads the returned `onScroll` onto its own
 * scrollable, and renders `<CollapsibleHeader header={…} />` above it. The scrollable stays
 * the screen's business — which is also how a screen keeps its own `onEndReached`, its key
 * extractor, and its recycling config without fighting an abstraction.
 *
 * ## Why `surface` and `hairline` are read once and passed down
 *
 * `useHeaderCollapse` documents the rule and this file honours it: a screen that scrolls a
 * long list must not subscribe *the header* to the theme separately, because the header is
 * rendered by the same component as the list. One `useAppTheme()` call at the top of the
 * hook, values passed as plain strings.
 *
 * ## The blur
 *
 * Real `BlurView` on iOS for a *static* detail bar; a scrolling bar gets the animated
 * solid backing `useHeaderCollapse` already computes. Re-blurring everything beneath a
 * translucent bar during a scroll is a per-frame cost Android pays badly, and at this
 * opacity the visual difference is a few percent of contrast.
 */
import { type ReactNode, useCallback, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAppTheme, type Theme } from '@/theme/theme';
import { radius, spacing, z } from '@/theme/tokens';
import { Icon, type IconName } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import { Row } from '@/ui/layout';
import { useHeaderCollapse } from '@/ui/animation';

/** Height of the compact bar, excluding any top safe-area inset. */
const BAR_HEIGHT = 52;
/** Distance over which the large title collapses — a little under one title height, so the
 * compact title is fully in before the hero has left the screen. */
const COLLAPSE_DISTANCE = 72;

export const SCREEN_BAR_HEIGHT = BAR_HEIGHT;

/* -------------------------------------------------------------- containers -- */

/**
 * Opaque screen background, edge to edge.
 *
 * Every route screen wraps itself in this rather than relying on the navigator's
 * `contentStyle`: with a transparent `contentStyle` (set in the root layout so a push does
 * not flash a second background over the outgoing screen), a screen with no container of its
 * own would let the previous screen show through during the transition.
 */
export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>{children}</View>
  );
}

/* --------------------------------------------------------------- detail bar -- */

export type DetailHeader = {
  /** Drive the body's `onScroll` with this so the bar can gain a backing. */
  onScroll: ScrollToSharedValue;
  scrollY: SharedValue<number>;
};

/**
 * Writes scroll offset into a shared value, from the JS thread.
 *
 * This is deliberately *not* `useAnimatedScrollHandler`, which is the obvious thing and does
 * not work here. That hook returns an event-handler *object* (`{ workletEventHandler }`) built
 * to be consumed by Reanimated's `createAnimatedComponent` — reanimated's docs say to pass it
 * to `Animated.ScrollView`'s `onScroll`. These screens scroll a `FlashList`, whose own
 * `AnimatedFlashList` is wrapped with *RN's* `Animated`, not Reanimated's, so nothing on that
 * side recognises the object. FlashList's native code does
 * `props.onScroll?.call(props, event)` — and an object is not callable, so every scroll frame
 * threw "undefined is not a function" while the header quietly never collapsed.
 *
 * The cost is real and small: offset crosses to the UI thread per JS scroll event
 * (`scrollEventThrottle={16}`) instead of the worklet running there, so during a heavy list
 * recycle the backing can trail by one JS frame. On a frosted colour and a title opacity —
 * the only things `useHeaderCollapse` drives — that is below the threshold of notice. A
 * transform-critical gesture follower would need Reanimated's own scrollable, and does not
 * exist here.
 */
export type ScrollToSharedValue = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

function useScrollOffsetWriter(scrollY: SharedValue<number>): ScrollToSharedValue {
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );
}

/**
 * A pushed screen: fixed bar, and a body that is told how far to pad to clear it.
 *
 * The body receives the inset as an argument rather than being absolutely positioned under
 * the bar. A list that scrolls *under* a bar needs its first row offset by padding — without
 * it the first item slides out of view behind the title rather than under it, which reads to
 * a user as a clipping bug.
 */
export function DetailScreen({
  title,
  subtitle,
  right,
  children,
  headerTransparent = false,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Receives the inset to pad by, and the scroll handler to attach. */
  children: (topInset: number, header: DetailHeader) => ReactNode;
  /** Full-bleed media underneath (an activity's map, an exercise photo). */
  headerTransparent?: boolean;
  onBack?: () => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useScrollOffsetWriter(scrollY);
  const barOpacity = useAnimatedStyle(() => ({
    opacity: Math.min(1, scrollY.value / 48),
  }));

  const goBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    // `back`, not `replace('/')`: the user expects the screen they came from, with its
    // scroll position intact. `canGoBack` covers the case where this screen *is* the entry
    // point — a deep link opened from a notification has nothing to return to, and a back
    // button that does nothing is worse than no back button.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [onBack]);

  const header = useMemo(() => ({ onScroll, scrollY }), [onScroll, scrollY]);

  return (
    <Screen>
      <View style={[styles.barWrap, { paddingTop: insets.top, zIndex: z.sticky }]} pointerEvents="box-none">
        {/* One backing or the other, never both: the animated one would otherwise sit under
            the blur and show through it as a grey wash at rest. */}
        {headerTransparent ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, barOpacity, { backgroundColor: theme.colors.background }]}
          />
        ) : (
          <View style={StyleSheet.absoluteFill}>
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={30}
                tint={theme.mode === 'dark' ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]} />
            )}
          </View>
        )}
        <Row align="center" gap="sm" style={[styles.bar, { height: BAR_HEIGHT }]}>
          <BarBackButton onPress={goBack} theme={theme} transparent={headerTransparent} />
          <View style={{ flex: 1 }}>
            <Txt variant="subhead" weight="700" numberOfLines={1}>
              {title}
            </Txt>
            {subtitle ? (
              <Txt variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </Txt>
            ) : null}
          </View>
          {right ? (
            <Row gap="xs" style={styles.barRight}>
              {right}
            </Row>
          ) : null}
        </Row>
      </View>
      {children(insets.top + BAR_HEIGHT, header)}
    </Screen>
  );
}

/* ----------------------------------------------------- collapsing tab bar -- */

/**
 * The scroll coupling for a root tab's large title. Call it in the screen, spread
 * `onScroll` onto the screen's own scrollable, and pass the result to
 * `<CollapsibleHeader>` / `<CollapsibleHero>`.
 */
export function useScreenHeaderScroll(distance = COLLAPSE_DISTANCE) {
  const theme = useAppTheme();
  const scrollY = useSharedValue(0);

  // The object form is required: the positional form takes the event directly. Passing a
  // bare function here would read `event.contentOffset` off the wrong shape and leave the
  // shared value at zero, i.e. a header that never collapses.
  const onScroll = useScrollOffsetWriter(scrollY);

  const collapse = useHeaderCollapse(scrollY, {
    distance,
    surface: theme.colors.background,
    hairline: theme.colors.hairline,
  });

  return { scrollY, onScroll, theme, ...collapse };
}

export type ScreenHeaderState = ReturnType<typeof useScreenHeaderScroll>;

/** The sticky half of a collapsing pair: translucent at rest, opaque once collapsed. */
export function CollapsibleHeader({
  header,
  title,
  right,
}: {
  header: ScreenHeaderState;
  title: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.barWrap, { zIndex: z.sticky }]} pointerEvents="box-none">
      <Animated.View style={[styles.bar, { height: insets.top + BAR_HEIGHT }, header.barStyle]}>
        <View style={styles.barSpacer} />
        <Animated.View style={[styles.barInner, header.inlineTitleStyle]}>
          <Txt variant="subhead" weight="700" numberOfLines={1}>
            {title}
          </Txt>
        </Animated.View>
        {right ? (
          <Row gap="xs" style={styles.barRight}>
            {right}
          </Row>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * The hero half: the big title plus anything the screen wants under it, rendered inside the
 * scroll view's content so it scrolls away normally. `CollapsibleHeader` and this must be
 * used together — the bar's compact title is invisible until this one has scrolled out.
 */
export function CollapsibleHero({
  header,
  title,
  eyebrow,
  children,
}: {
  header: ScreenHeaderState;
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + spacing.xxl, paddingHorizontal: spacing.lg }}>
      <Animated.View style={header.heroTitleStyle}>
        {eyebrow ? (
          <Txt variant="micro" tone="faint" uppercase tracking={1.1}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt variant="headline">{title}</Txt>
      </Animated.View>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------- parts -- */

function BarBackButton({
  onPress,
  theme,
  transparent,
}: {
  onPress: () => void;
  theme: Theme;
  transparent: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [
        styles.roundButton,
        {
          // Over full-bleed media the tap target needs its own scrim or it disappears
          // against a bright map tile.
          backgroundColor: transparent ? theme.colors.scrim : theme.colors.surfacePressed,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Icon name="arrowLeft" size={21} color={theme.colors.text} strokeWidth={2.1} />
    </Pressable>
  );
}

/** Circular icon button for a nav bar's trailing slot. */
export function BarAction({
  icon,
  onPress,
  label,
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  badge?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.roundButton,
        { backgroundColor: theme.colors.surfacePressed, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Icon name={icon} size={20} color={theme.colors.text} />
      {badge ? <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  barWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  // Keeps the collapsed title on the same left edge as the hero title above it, so the
  // title does not appear to jump sideways as it shrinks.
  barSpacer: { width: 0 },
  barInner: { flex: 1, alignItems: 'flex-start' },
  barRight: { marginLeft: 'auto' },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 4 },
});
