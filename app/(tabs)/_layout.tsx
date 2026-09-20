/**
 * Bottom tab bar — five destinations, one custom bar.
 *
 * ## Why `tabBar` is a custom component
 *
 * `@react-navigation/bottom-tabs` is vendored inside expo-router and its
 * `BottomTabBarProps` type is not re-exported from anywhere reachable, so the choice is
 * between an untyped `(props) => …` callback whose `descriptors` shape has to be guessed
 * and a headless bar driven by data the app already owns. The second is what happens here:
 * five entries declared once, in order, beside the five `Tabs.Screen` entries below, with
 * the active key derived from the live pathname rather than mirrored into state.
 *
 * It also buys what the stock bar cannot do without fighting it: the live-workout pill
 * floating above the bar, and a blur that follows the theme's `overlay` token instead of a
 * hard-coded system material.
 *
 * ## Why `headerShown: false` lives here and not only in the root layout
 *
 * The root `Stack` already sets `headerShown: false`, and that is *not* inherited: it applies
 * to the screens the root stack owns, including this group as one screen — it says nothing
 * about the screens *this* navigator owns. Left alone, bottom-tabs falls back to a
 * `Header` whose title is `getHeaderTitle(options, route.name)`, i.e. literally "index", and
 * that header paints an opaque bar across the top of every tab scene — over the large title
 * each screen draws itself, and over the settings control inside it. Each tab owns its header
 * (`CollapsibleHeader`), which is the only way a title can collapse on scroll; the navigator's
 * must stay off for that to be the only one.
 *
 * Home and Activities are where a user lands within the first second. Lazy-mounting them
 * makes the first tap pay a mount *and* a query, which reads as a slow app. Exercises is
 * lazy because it mounts a remote query that Home does not need at launch; Profile and
 * Workout for the same reason in reverse. The cost — two screens mounted cold — is bounded
 * and small, and it is the cost that makes the first tab switch feel instant.
 */
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes, tabHref, tabKeyForPathname, type TabKey } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, z } from '@/theme/tokens';
import { ActiveWorkoutPill, TabBar, type TabItem } from '@/ui/TabBar';
import { useAnySheetMounted } from '@/ui/sheetPresence';
import { formatDuration } from '@/utils/format';
import { useWorkoutSession } from '@/workout/session';

/**
 * A tuple-shaped `const` so a missing or extra entry is a compile error rather than a bar
 * with four items and five screens. This order *is* the visual order.
 *
 * `exercises` uses `search` rather than a dumbbell-and-list hybrid because the tab's job is
 * discovery in the wger catalog, and the icon that promises that is the one the library has.
 */
const TABS: readonly TabItem[] = [
  // Icon names are constrained to the glyph set in `ui/icons.tsx`; `library` rather than
  // `search` because this tab is a browse surface you can also search, not a search field.
  { routeKey: 'index', label: 'Home', icon: 'home' },
  { routeKey: 'activities', label: 'Activities', icon: 'activities' },
  { routeKey: 'workout', label: 'Workout', icon: 'workout' },
  { routeKey: 'exercises', label: 'Exercises', icon: 'library' },
  { routeKey: 'profile', label: 'Profile', icon: 'profile' },
] as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Derived from the pathname and collapsed to a tab, so a push *within* a tab
  // (`/activities` → `/activity/12`) does not re-render the bar, and a sheet that covers
  // the tabs still reports the tab it was opened from — which is what keeps the bar lit on
  // the right destination when the sheet closes.
  const activeKey = tabKeyForPathname(pathname) ?? 'index';

  const onSelect = useCallback((key: string) => {
    const index = TABS.findIndex((item) => item.routeKey === key);
    if (index < 0) return;
    // `navigate`, not `push`: tapping the tab you are on must not stack a second copy, and
    // moving between tabs must restore the previous scroll position rather than reset it.
    // Both are `navigate` semantics; `push` gets neither.
    router.navigate(tabHref(index));
  }, []);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={() => (
        <TabBarWithPill activeKey={activeKey} onSelect={onSelect} bottomInset={insets.bottom} />
      )}
    >
      <Tabs.Screen name="index" options={{ lazy: false }} />
      <Tabs.Screen name="activities" options={{ lazy: false }} />
      <Tabs.Screen name="workout" options={{ lazy: true }} />
      <Tabs.Screen name="exercises" options={{ lazy: true }} />
      <Tabs.Screen name="profile" options={{ lazy: true }} />
    </Tabs>
  );
}

/**
 * The bar plus the pill that floats above it.
 *
 * A separate component because the pill needs the live session, which ticks once per
 * second while a workout runs. Mounted beside `TabBar` inside the `tabBar` callback, that
 * per-second publish would re-render the bar's five items and restart the indicator spring
 * every tick. Split, the tick re-renders only the pill.
 */
function TabBarWithPill({
  activeKey,
  onSelect,
  bottomInset,
}: {
  activeKey: TabKey;
  onSelect: (key: string) => void;
  bottomInset: number;
}) {
  const theme = useAppTheme();
  const { session } = useWorkoutSession();
  const running = session !== null && (session.status === 'active' || session.status === 'paused');
  // Subscribed here rather than in `TabsLayout` so opening a sheet re-renders the bar and
  // nothing above it — the navigator, and through it every mounted screen, stays put.
  const sheetUp = useAnySheetMounted();

  return (
    <>
      {running && session && !sheetUp ? (
        // Absolutely positioned above the bar rather than stacked under it: `TabBar` is
        // itself `position: 'absolute', bottom: 0, zIndex: z.sheet`, so a sibling in normal
        // flow would sit *behind* it at the bottom of the screen. The offset hard-codes the
        // bar's own height because the bar does not export it and measuring it here would
        // need a second layout pass for one number.
        <View
          style={[
            pillStyles.wrap,
            { bottom: bottomInset + BAR_HEIGHT + spacing.sm, backgroundColor: 'transparent' },
          ]}
          pointerEvents="box-none"
        >
          <ActiveWorkoutPill
            label={session.routineName}
            detail={
              session.status === 'paused'
                ? 'Paused'
                : formatDuration(session.elapsedSeconds, ':')
            }
            onPress={() => {
              router.push(routes.workoutSession());
            }}
            theme={theme}
          />
        </View>
      ) : null}
      <TabBar
        items={[...TABS]}
        activeKey={activeKey}
        onSelect={onSelect}
        bottomInset={bottomInset}
        hidden={sheetUp}
      />
    </>
  );
}

/** Mirrors `BAR_HEIGHT` inside `TabBar.tsx`. If that changes, this changes with it. */
const BAR_HEIGHT = 60;

const pillStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // Above the bar's own `z.sheet` so the pill is never clipped by it during the
    // indicator spring.
    zIndex: z.sheet + 1,
  },
});
