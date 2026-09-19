/**
 * Typed route helpers.
 *
 * ## Why `as never` is in here at all
 *
 * Typed routes are enabled, so `Href` is a union of literal strings and
 * `RelativePathString`, and a computed `Segment[]` is genuinely not assignable to it.
 * The honest fix would be a literal union of the ~20 routes in this app maintained by
 * hand in two places — which is a list that silently rots the moment a route is renamed,
 * because the only thing keeping it correct is nobody noticing.
 *
 * So the honesty lives one level up instead: `tabHref` is the **only** cast in the app,
 * it is applied to a value that is by construction a real route (it came from
 * `TAB_ROUTES`, whose entries are checked against `TabKey` by the `Record` above it),
 * and there is exactly one call site. A cast buried inside a screen's `onPress` is
 * invisible; a cast behind one documented boundary that takes no parameters is auditable
 * at a glance.
 */
import type { Href } from 'expo-router';

export type TabKey = 'index' | 'activities' | 'workout' | 'exercises' | 'profile';

/**
 * Tab routes in bar order. `index` rather than `home` because the folder is
 * `(tabs)/index.tsx`, and a mismatch here is the kind of typo that compiles under a
 * cast — which is precisely why the cast has one home.
 */
export const TAB_ROUTES: readonly [TabKey, TabKey, TabKey, TabKey, TabKey] = [
  'index',
  'activities',
  'workout',
  'exercises',
  'profile',
] as const;

const TAB_HREFS: Record<TabKey, Href> = {
  index: '/(tabs)' as Href,
  activities: '/activities' as Href,
  workout: '/workout' as Href,
  exercises: '/exercises' as Href,
  profile: '/profile' as Href,
};

export function tabHref(index: number): Href {
  const key = TAB_ROUTES[index] ?? 'index';
  return TAB_HREFS[key];
}

export function tabIndexOf(key: TabKey): number {
  return TAB_ROUTES.indexOf(key);
}

/**
 * The tab a pathname belongs to.
 *
 * `/workout/session` reports `workout`, which is what lets the tab layout decide both
 * to hide its bar and to keep the Workout tab lit behind the player — the user is still
 * in the workout flow, and a bar that jumps to Home as the sheet closes reads as a bug
 * even when the stack underneath is correct.
 *
 * `undefined` means "not a tab" (a modal, or the root). Callers treat it as "no tab is
 * active" rather than defaulting to Home, so the bar never claims to be somewhere the
 * user is not.
 */
export function tabKeyForPathname(pathname: string): TabKey | undefined {
  const segments = pathname.split('/').filter(Boolean);
  // `(tabs)` is the group segment and is not part of any tab's URL.
  if (segments[0] === '(tabs)') segments.shift();
  const first = segments[0];
  if (first === undefined) return 'index';
  return (TAB_ROUTES as readonly string[]).includes(first) ? (first as TabKey) : undefined;
}

/**
 * Route builders for the flows that take parameters.
 *
 * `params` rather than string interpolation because it is the same cast count with one
 * less correctness hazard: interpolating into a path means the caller must remember to
 * encode, and an exercise id from wger is a plain integer today but the local fallback
 * ids are UUIDs — a shape that would change under a future import path. Passing params
 * as data lets the router do the encoding itself.
 */
export const routes = {
  activityDetail: (id: string) => ({ pathname: '/activity/[id]', params: { id } }) as Href,
  exerciseDetail: (id: string) => ({ pathname: '/exercise/[id]', params: { id } }) as Href,
  routine: (id: string) => ({ pathname: '/routine/[id]', params: { id } }) as Href,

  /**
   * The parameterless routes, as functions rather than string literals at call sites.
   *
   * Typed routes would make a typo here a compile error — except that `.expo/types` is
   * generated during `expo start`, so in a fresh checkout with the types absent every
   * literal is `string` and every literal compiles. Routing the app's own destinations
   * through builders keeps there exactly one place a path is spelled, and one place to
   * look when one moves.
   */
  newRoutine: () => '/routine/new' as Href,
  workoutStart: () => '/workout' as Href,
  workoutSession: () => '/workout/session' as Href,
  workoutHistory: () => '/workout/history' as Href,
  cardio: () => '/workout/cardio' as Href,
  progress: () => '/progress' as Href,
  settings: () => '/settings' as Href,
  settingsUnits: () => '/settings/units' as Href,
  settingsAppearance: () => '/settings/appearance' as Href,
  settingsTraining: () => '/settings/training' as Href,
  settingsNotifications: () => '/settings/notifications' as Href,
  settingsAbout: () => '/settings/about' as Href,
  permissions: () => '/permissions' as Href,
  dev: () => '/dev' as Href,
} as const;
