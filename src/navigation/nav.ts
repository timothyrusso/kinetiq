/**
 * Typed route helpers.
 *
 * ## Why `as never` is in here at all
 *
 * Typed routes are enabled, so `Href` is a union of literal strings and
 * `RelativePathString`, and a computed `Segment[]` is genuinely not assignable to it.
 * The honest fix would be a literal union of the ~20 routes in this app maintained by
 * hand in two places: which is a list that silently rots the moment a route is renamed,
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
import type { PersonalRecord } from '@/domain/types';
import type { TKey } from '@/i18n';

export type TabKey = '(home)' | 'activities' | 'workout' | 'exercises' | 'profile';

/**
 * Tab routes in bar order. `(home)` rather than `home` because Home is the group
 * `(tabs)/(home)/`: a group, not a folder, so its URL stays `/` while it still gets a
 * stack of its own. A mismatch here is the kind of typo that compiles under a cast, which
 * is precisely why the cast has one home.
 */
export const TAB_ROUTES: readonly [TabKey, TabKey, TabKey, TabKey, TabKey] = [
  '(home)',
  'activities',
  'workout',
  'exercises',
  'profile',
] as const;

const TAB_HREFS: Record<TabKey, Href> = {
  '(home)': '/(tabs)' as Href,
  activities: '/activities' as Href,
  workout: '/workout' as Href,
  exercises: '/exercises' as Href,
  profile: '/profile' as Href,
};

/**
 * What each tab is called in the bar.
 *
 * Lives here rather than beside the bar's own list because the not-found screen offers the
 * same five destinations as text and must not maintain a second spelling of them. `(home)` is
 * "Home": the group segment is a routing fact, the label is a product one.
 */
/**
 * Tab names as catalog KEYS.
 *
 * Module scope has no language, so a map of English words here is a map that stays English.
 * The tab bar itself reads `tabs.*` through `useT`; this table exists for the places that
 * reference a tab by name without rendering the bar, such as the not-found screen.
 */
export const TAB_LABELS: Record<TabKey, TKey> = {
  '(home)': 'tabs.home',
  activities: 'tabs.activities',
  workout: 'tabs.workout',
  exercises: 'tabs.exercises',
  profile: 'tabs.profile',
};

export function tabHref(index: number): Href {
  const key = TAB_ROUTES[index] ?? '(home)';
  return TAB_HREFS[key];
}

export function tabIndexOf(key: TabKey): number {
  return TAB_ROUTES.indexOf(key);
}

/**
 * The tab a pathname belongs to.
 *
 * `/workout/session` reports `workout`, which is what lets the tab layout decide both
 * to hide its bar and to keep the Workout tab lit behind the player: the user is still
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
  if (segments[0] === '(home)') segments.shift();
  const first = segments[0];
  if (first === undefined) return '(home)';
  return (TAB_ROUTES as readonly string[]).includes(first) ? (first as TabKey) : undefined;
}

/**
 * Route builders for the flows that take parameters.
 *
 * `params` rather than string interpolation because it is the same cast count with one
 * less correctness hazard: interpolating into a path means the caller must remember to
 * encode, and an exercise id from wger is a plain integer today but the local fallback
 * ids are UUIDs: a shape that would change under a future import path. Passing params
 * as data lets the router do the encoding itself.
 */
export const routes = {
  activityDetail: (id: string) => ({ pathname: '/activity/[id]', params: { id } }) as Href,
  exerciseDetail: (id: string) => ({ pathname: '/exercise/[id]', params: { id } }) as Href,
  routine: (id: string) => ({ pathname: '/routine/[id]', params: { id } }) as Href,

  /**
   * The parameterless routes, as functions rather than string literals at call sites.
   *
   * Typed routes would make a typo here a compile error: except that `.expo/types` is
   * generated during `expo start`, so in a fresh checkout with the types absent every
   * literal is `string` and every literal compiles. Routing the app's own destinations
   * through builders keeps there exactly one place a path is spelled, and one place to
   * look when one moves.
   */
  newRoutine: () => '/routine/new' as Href,
  /**
   * The Workout tab, not a "start" screen.
   *
   * `/workout` is a `TAB_ROUTES` entry, so the tab owns that path: a screen at
   * `app/workout.tsx` would fight it for the same URL. Anything asking to "go start a
   * workout" means the tab, which is where the routines and the resume card live.
   */
  workoutTab: () => tabHref(2) as Href,
  /**
   * The Exercises *tab*, not a detail screen.
   *
   * `tabHref` rather than `'/exercises'` because the literal happens to work either way and
   * that is the problem: it resolves through the group and the bar stops highlighting
   * properly, which reads as a rendering glitch three screens later.
   */
  exercisesTab: () => tabHref(3) as Href,
  workoutSession: () => '/workout/session' as Href,
  workoutHistory: () => '/workout/history' as Href,
  cardio: () => '/workout/cardio' as Href,
  progress: () => '/progress' as Href,
  settings: () => '/settings' as Href,
  settingsTraining: () => '/settings/training' as Href,
  settingsNotifications: () => '/settings/notifications' as Href,
  settingsAbout: () => '/settings/about' as Href,
  permissions: () => '/permissions' as Href,
  dev: () => '/dev' as Href,

  /**
   * The editors, presented as form sheets. Each takes what it edits as params and writes
   * through the store or query that owns it, so nothing comes back through the navigation.
   */
  pickExercise: (target: 'draft' | 'session' | 'routine', routineId?: string) =>
    ({ pathname: '/pick-exercise', params: routineId ? { target, id: routineId } : { target } }) as Href,
  routineItem: (target: 'draft' | 'routine', itemId: string, routineId?: string) =>
    ({
      pathname: '/routine/item',
      params: routineId ? { target, item: itemId, id: routineId } : { target, item: itemId },
    }) as Href,
  renameRoutine: (id: string) => ({ pathname: '/routine/rename', params: { id } }) as Href,
  activityNotes: (id: string) => ({ pathname: '/activity/notes', params: { id } }) as Href,
  /**
   * The library pushed over a detail screen, so back returns there (see `exerciseLibrary.tsx`).
   * Its starting filter travels in the params: the pushed list owns its own filter store.
   */
  exerciseBrowse: (start: { query?: string; muscleId?: number; equipmentId?: number }) =>
    ({
      pathname: '/exercise/browse',
      params: {
        ...(start.query !== undefined ? { query: start.query } : {}),
        ...(start.muscleId !== undefined ? { muscleId: String(start.muscleId) } : {}),
        ...(start.equipmentId !== undefined ? { equipmentId: String(start.equipmentId) } : {}),
      },
    }) as Href,
  /** The filter sheet, for the tab's list, or for a pushed list's store by its key. */
  exerciseFilters: (storeKey?: string) =>
    (storeKey === undefined
      ? '/exercise/filters'
      : { pathname: '/exercise/filters', params: { storeKey } }) as Href,
  sessionNotes: () => '/workout/notes' as Href,
  sessionSet: (entryIndex: number, setIndex: number) =>
    ({ pathname: '/workout/set', params: { entry: String(entryIndex), set: String(setIndex) } }) as Href,
  sessionRecords: (records: readonly PersonalRecord[]) =>
    ({ pathname: '/workout/records', params: { records: JSON.stringify(records) } }) as Href,
} as const;
