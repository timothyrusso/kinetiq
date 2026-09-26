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

export type TabKey = '(home)' | 'workout' | 'profile';

/**
 * Tab routes in bar order. `(home)` rather than `home` because Home is the group
 * `(tabs)/(home)/`: a group, not a folder, so its URL stays `/` while it still gets a
 * stack of its own. A mismatch here is the kind of typo that compiles under a cast, which
 * is precisely why the cast has one home.
 */
export const TAB_ROUTES: readonly [TabKey, TabKey, TabKey] = ['(home)', 'workout', 'profile'] as const;

const TAB_HREFS: Record<TabKey, Href> = {
  '(home)': '/(tabs)' as Href,
  workout: '/workout' as Href,
  profile: '/profile' as Href,
};

/**
 * Tab names as catalog KEYS.
 *
 * Lives here rather than beside the bar's own list because the not-found screen offers the
 * same destinations as text and must not maintain a second spelling of them.
 *
 * Module scope has no language, so a map of English words here is a map that stays English.
 * The tab bar itself reads `tabs.*` through `useT`; this table exists for the places that
 * reference a tab by name without rendering the bar, such as the not-found screen.
 */
export const TAB_LABELS: Record<TabKey, TKey> = {
  '(home)': 'tabs.home',
  workout: 'tabs.workout',
  profile: 'tabs.profile',
};

export function tabHref(index: number): Href {
  const key = TAB_ROUTES[index] ?? '(home)';
  return TAB_HREFS[key];
}

function tabIndexOf(key: TabKey): number {
  return TAB_ROUTES.indexOf(key);
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
  workoutTab: () => tabHref(tabIndexOf('workout')) as Href,
  home: () => tabHref(tabIndexOf('(home)')) as Href,
  workoutSession: () => '/workout/session' as Href,
  settingsTraining: () => '/settings/training' as Href,
  settingsNotifications: () => '/settings/notifications' as Href,
  settingsAbout: () => '/settings/about' as Href,
  settingsData: () => '/settings/data' as Href,
  importPreview: () => '/settings/import' as Href,
  editProfile: () => '/edit-profile' as Href,

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
  sessionNotes: () => '/workout/notes' as Href,
  sessionSet: (entryIndex: number, setIndex: number) =>
    ({ pathname: '/workout/set', params: { entry: String(entryIndex), set: String(setIndex) } }) as Href,
  sessionRecords: (records: readonly PersonalRecord[]) =>
    ({ pathname: '/workout/records', params: { records: JSON.stringify(records) } }) as Href,
} as const;
