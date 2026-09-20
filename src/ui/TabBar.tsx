/**
 * The tab bar.
 *
 * Custom rather than the platform bar for three reasons. The active indicator has to
 * travel between items instead of fading in place. Press feedback has to reach the
 * icon's stroke weight, which the platform bar exposes no handle for. And the bar
 * floats a "workout running" pill, which a stock bar could only do by re-rendering
 * the navigator that owns it.
 *
 * Blur is real on iOS and effectively a tinted panel on Android unless the heavier
 * native method is enabled, which re-blurs everything beneath it during scrolling. So:
 * blur on iOS, opaque surface elsewhere. A translucent bar that drops frames in a list
 * is worse than an opaque one, and at this opacity the visual difference is a few
 * percent of contrast.
 *
 * Geometry comes from `onLayout` and is held in shared values. Item widths are the
 * window minus safe area divided by five, but computing that in JS breaks under a
 * larger accessibility font and in landscape; measuring is correct in all of those.
 */
import { memo, useCallback, useEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Icon, type IconName } from './icons';
import { CellText } from './rows';
import { usePulse } from './animation';
import { radius, spacing, z } from '@/theme/tokens';
import { useAppTheme, type Theme } from '@/theme/theme';

export type TabItem = {
  /** Route name as it appears in the tabs navigator's state. */
  routeKey: string;
  label: string;
  icon: IconName;
  /** "Something here changed" — a dot, deliberately never a badge count. */
  dot?: boolean;
};

const BAR_HEIGHT = 60;
const ITEM_MIN_HEIGHT = 48;
/** Horizontal padding of the item row; indicator x is measured inside it. */
const BAR_PADDING = spacing.md;

export const TabBar = memo(function TabBar({
  items,
  activeKey,
  onSelect,
  bottomInset,
  hidden = false,
  style,
}: {
  items: TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Home-indicator inset, passed in rather than read here so the bar stays pure. */
  bottomInset: number;
  /**
   * Takes the bar out of the tree. A sheet on a tab screen cannot rise above this bar,
   * because the bar is painted by the navigator and the sheet lives inside the scene —
   * separate view hierarchies, so no `zIndex` crosses between them. See
   * `ui/sheetPresence.ts` for why the bar yields rather than the sheet being rebuilt as a
   * native `Modal`: without yielding, a sheet's own footer lands under the bar and a tap
   * there changes tab instead of pressing the button the user can see.
   */
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const safeBottom = Math.max(bottomInset, spacing.sm);

  /**
   * Slot geometry, written straight into shared values from the layout callback.
   *
   * Deliberately not state: these numbers are only ever read inside worklets, so
   * keeping them in state would re-render five tabs on every measurement (five on
   * mount, five again on rotation) to move a rectangle that can animate from a ref.
   */
  const xTargets = useRef({} as Record<string, { x: number; w: number }>).current;
  const translateX = useSharedValue(0);
  const width = useSharedValue(0);
  /** 0 until the active slot has been measured, so the pill never flashes at x=0. */
  const visible = useSharedValue(0);

  const moveTo = useCallback(
    (key: string, animate: boolean) => {
      const slot = xTargets[key];
      if (!slot) {
        visible.value = 0;
        return;
      }
      const spring = reduced || !animate;
      translateX.value = spring
        ? withTiming(slot.x, { duration: 0 })
        : withSpring(slot.x, TAB_SPRING);
      width.value = spring ? withTiming(slot.w, { duration: 0 }) : withSpring(slot.w, TAB_SPRING);
      visible.value = 1;
    },
    [reduced, translateX, visible, width, xTargets],
  );

  // Selection changes fire no layout pass, so the pill has to be re-placed explicitly
  // when the active tab changes. Doing this in an effect rather than during render
  // means the shared value is written after React has committed, which is also when
  // the UI thread is idle enough to start the spring.
  useEffect(() => {
    moveTo(activeKey, true);
  }, [activeKey, moveTo]);

  const measure = useCallback(
    (key: string, x: number, w: number) => {
      const prev = xTargets[key];
      if (prev && prev.x === x && prev.w === w) return;
      xTargets[key] = { x, w };
      // Re-place the indicator whenever the *active* slot moves or resizes, which is
      // what has to happen on rotation — the tab does not change, the geometry does.
      if (key === activeKey) moveTo(key, false);
    },
    [activeKey, moveTo, xTargets],
  );

  const indicatorStyle = useAnimatedStyle(
    () => ({
      opacity: visible.value,
      width: width.value,
      transform: [{ translateX: translateX.value }],
    }),
    [translateX, visible, width],
  );

  // Removed rather than faded: a bar that is merely transparent still swallows the taps
  // aimed at the sheet footer underneath it, which is half the bug. Remounting is cheap
  // and the indicator does not slide in from x=0 to greet the user, because the layout
  // callback re-places the active slot with `moveTo(key, false)` — no animation — before
  // anything has been drawn.
  if (hidden) return null;

  return (
    <View
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: z.sheet }, style]}
      // Landmark semantics: one "tab list" with a labelled stop per destination,
      // rather than an anonymous row of five icons.
      accessibilityRole="tablist"
    >
      <BarSurface theme={theme} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: BAR_HEIGHT + safeBottom,
          paddingTop: 0,
          paddingBottom: safeBottom,
          paddingHorizontal: BAR_PADDING,
        }}
      >
        {items.map((item) => (
          <TabButton
            key={item.routeKey}
            item={item}
            selected={item.routeKey === activeKey}
            onSelect={onSelect}
            onMeasure={measure}
            theme={theme}
          />
        ))}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: BAR_PADDING,
            top: (BAR_HEIGHT - 40) / 2,
            height: 40,
            borderRadius: radius.lg,
            backgroundColor: theme.colors.accentSoft,
          },
          indicatorStyle,
        ]}
      />
    </View>
  );
});

const TabButton = memo(function TabButton({
  item,
  selected,
  onSelect,
  onMeasure,
  theme,
}: {
  item: TabItem;
  selected: boolean;
  onSelect: (key: string) => void;
  onMeasure: (key: string, x: number, w: number) => void;
  theme: Theme;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={item.label}
      onPress={() => onSelect(item.routeKey)}
      // x is relative to the item row; the bar adds its own padding back in when it
      // positions the indicator, so the two never disagree about the origin.
      onLayout={(e) => onMeasure(item.routeKey, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minHeight: ITEM_MIN_HEIGHT,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Icon
          name={item.icon}
          size={23}
          // Weight, not just colour, carries the selected state: at a glance across a
          // room, a thicker stroke reads as "here" before the colour registers.
          strokeWidth={selected ? 2.2 : 1.7}
          color={selected ? theme.colors.accent : theme.colors.textFaint}
        />
        {item.dot ? (
          <View
            style={{
              position: 'absolute',
              top: -1,
              right: -4,
              width: 8,
              height: 8,
              borderRadius: radius.pill,
              backgroundColor: theme.colors.tertiary,
              borderWidth: 2,
              borderColor: theme.colors.overlay,
            }}
          />
        ) : null}
      </View>
      <CellText
        text={item.label}
        variant="micro"
        weight={selected ? '700' : '500'}
        color={selected ? theme.colors.text : theme.colors.textFaint}
      />
    </Pressable>
  );
});

/**
 * Frosted (iOS) or solid (Android) backing — a sibling of the items rather than their
 * parent, because a blur surface *containing* children re-blurs on every child update,
 * which is precisely the press feedback we need to keep cheap.
 */
const BarSurface = memo(function BarSurface({ theme }: { theme: Theme }) {
  const hairline = (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.overlayBorder,
      }}
    />
  );
  const base = (
    // An opaque base first, so the bar is never transparent to the content behind it
    // even if the material fails to initialise.
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]} />
  );
  if (Platform.OS !== 'ios') return [base, hairline];
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
 * Live-session pill, floating above the bar so it is reachable from every tab without
 * covering what the user is reading. The dot breathes: a static dot says "a session
 * exists", a breathing one says it is happening now — which is the distinction that
 * matters when you come back to the app twenty minutes later.
 */
export const ActiveWorkoutPill = memo(function ActiveWorkoutPill({
  label,
  detail,
  onPress,
  theme,
}: {
  label: string;
  /** Elapsed time or set count — whatever the session wants to advertise. */
  detail?: string;
  onPress: () => void;
  theme: Theme;
}) {
  const pulse = usePulse(1600, 0.35);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityHint="Opens the workout in progress"
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm + 2,
          borderRadius: radius.pill,
          backgroundColor: theme.colors.surfaceRaised,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.88 : 1,
          ...theme.shadows.raised,
        },
      ]}
    >
      <Animated.View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: theme.colors.tertiary,
          },
          pulse,
        ]}
      />
      <CellText text={label} variant="label" weight="600" color={theme.colors.text} />
      {detail ? (
        <CellText text={detail} variant="monoSm" color={theme.colors.textMuted} />
      ) : null}
      <Icon name="chevronRight" size={15} color={theme.colors.textFaint} />
    </Pressable>
  );
});

/** The bar's travel is its own gesture, so it is tuned here rather than in tokens. */
const TAB_SPRING = { damping: 24, stiffness: 300, mass: 0.8 } as const;

export type TabBarProps = React.ComponentProps<typeof TabBar>;
