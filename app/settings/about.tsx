/**
 * About: what this build is, where the exercise data comes from, and how to get rid of it.
 *
 * ## Version comes from the app config, not a hard-coded string
 *
 * `Constants.expoConfig?.version` is the same `app.json` field that gets stamped into the
 * binary, so the number on this screen is the number the store will show. A literal '1.0.0'
 * here is a bug that goes off quietly the first time someone bumps the version and forgets
 * this screen exists.
 *
 * There is no build number. Reading it needs `expo-application`, which is not a dependency,
 * and adding a native module to display one digit users will never compare is a bad trade.
 * What a support conversation actually needs is on this card instead: the app id, and the
 * database schema version.
 *
 * ## The exercise catalog is named because it is someone else's data
 *
 * The library is served by wger, so that belongs on the screen that attributes it. It also
 * earns its place by being load-bearing information: exercises are stored as local snapshots
 * precisely so the catalog can vanish without taking the user's routines with it, and this is
 * where that design becomes visible to them. The second paragraph answers the question the
 * first one raises, "what happens to my stuff when it's down?".
 *
 * ## The counts read the list cache, not SQL
 *
 * `useActivityList` with the default params is the *same* query the Activities tab uses, * frozen default params, so the key matches: and its raw rows are cached unsorted and
 * ungrouped. Counting them here costs one pass over data the app is already holding. A second
 * query for "how many activities" would be a second source of truth for one number, and the
 * only thing that buys is a way for two screens to disagree.
 *
 * ## Reset
 *
 * A destructive control that says "erase everything" is easy to tap by accident and impossible
 * to undo. `ConfirmSheet` is the app's one confirmation idiom: the same one workout discard
 * uses: and the copy spells out what is destroyed, including the demo history, because
 * "it came back on its own" is the most confusing possible outcome of a wipe.
 */
import { useCallback, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsSection } from '@/ui/controls/SettingsList';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { getExerciseProvider } from '@/api';
import { clearAllUserData, readSchemaVersion } from '@/persistence';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '@/settings';
import { KIND_ORDER } from '@/domain/display';
import type { ActivityKind } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useActivityList } from '@/queries/useActivities';
import { useRoutines } from '@/queries/useRoutines';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';


export default function SettingsAboutScreen() {
  const { t } = useT();
  const queryClient = useQueryClient();

  const provider = getExerciseProvider();
  const config = Constants.expoConfig;
  const version = config?.version ?? null;
  const appId = config?.ios?.bundleIdentifier ?? config?.android?.package ?? config?.slug ?? null;
  const schema = useSchemaVersion();

  const unitSystem = useSettings((s) => s.unitSystem);
  const themeMode = useSettings((s) => s.themeMode);
  // Default params = the Activities tab's own query key, so this renders from a cache the app
  // has already filled. See the module header.
  const activityList = useActivityList();
  const { routines, isLoading: routinesLoading } = useRoutines();

  const [confirming, setConfirming] = useState(false);
  const [erasing, setErasing] = useState(false);

  const activities = activityList.flat;
  const counts = useMemo(() => tally(activities), [activities]);
  const activityCount = activities.length;

  const erase = useCallback(async () => {
    setErasing(true);
    try {
      // Order matters. Data first, then the caches that describe it, then settings last, // settings is the one step that writes back to the database, so doing it earlier would
      // have the wipe undone by its own next step.
      await clearAllUserData();
      await queryClient.cancelQueries();
      queryClient.clear();
      updateSettings(DEFAULT_SETTINGS);
      haptics.success();
    } catch {
      haptics.warning();
    } finally {
      setErasing(false);
      setConfirming(false);
    }
  }, [queryClient]);

  const sections = useMemo<SettingsSection[]>(() => {
    const list: SettingsSection[] = [
      {
        key: 'build',
        // The product name, which is the one string that is not translated.
        title: 'Kinetiq',
        footer: t('about.storageNote'),
        rows: [
          { kind: 'info', key: 'version', title: t('about.version'), value: version ?? t('about.unknown') },
          {
            kind: 'info',
            key: 'appId',
            title: t('about.appId'),
            subtitle: t('about.appIdHint'),
            value: appId ?? t('about.unknown'),
          },
          { kind: 'info', key: 'schema', title: t('about.schema'), value: `v${schema}` },
        ],
      },
      {
        key: 'catalog',
        title: t('about.catalog'),
        footer: [t('about.catalogNote'), t('about.localNote'), provider.supportsOffline ? null : t('about.needsConnection')]
          .filter(Boolean)
          .join('\n\n'),
        rows: [
          {
            kind: 'info',
            key: 'provider',
            title: LABELLED_PROVIDERS[provider.name] ?? provider.name,
            subtitle: t('about.servedRemotely'),
          },
        ],
      },
      {
        key: 'device',
        title: t('about.onThisDevice'),
        rows: [
          ...(activityList.isLoading
            ? [{ kind: 'info' as const, key: 'counting', title: t('about.activities'), value: t('about.counting') }]
            : activityCount === 0
              ? [{ kind: 'info' as const, key: 'none', title: t('about.nothingStored') }]
              : KIND_ORDER.filter((kind) => (counts[kind] ?? 0) > 0).map((kind) => ({
                  kind: 'info' as const,
                  key: `kind-${kind}`,
                  title: t(KIND_NAMES[kind]),
                  value: String(counts[kind] ?? 0),
                }))),
          {
            kind: 'info',
            key: 'routines',
            title: t('about.routines'),
            subtitle: t('about.routinesHint'),
            value: routinesLoading ? t('about.counting') : String(routines.length),
          },
          {
            kind: 'info',
            key: 'units',
            title: t('about.units'),
            value: t(unitSystem === 'metric' ? 'settings.metric' : 'settings.imperial'),
          },
          {
            kind: 'info',
            key: 'appearance',
            title: t('about.appearance'),
            value: t(
              themeMode === 'system' ? 'about.matchSystem' : themeMode === 'light' ? 'settings.light' : 'settings.dark',
            ),
          },
        ],
      },
    ];
    // Compiled into the route table either way (expo-router has no conditional routes), so
    // `app/dev.tsx` returns null outside __DEV__ too. The entry point is what is gated: a
    // row that leads to a blank screen is worse than no row.
    if (__DEV__) {
      list.push({
        key: 'dev',
        title: t('about.developer'),
        footer: t('about.thisBuildOnly'),
        rows: [
          {
            kind: 'nav',
            key: 'faults',
            title: t('about.faultInjection'),
            subtitle: t('about.faultSubtitle'),
            onPress: () => router.push(routes.dev()),
          },
        ],
      });
    }
    list.push({
      key: 'reset',
      title: t('about.reset'),
      footer: `${t('about.eraseNote')}\n\n${t('about.builtWith')}`,
      rows: [
        {
          kind: 'button',
          key: 'erase',
          title: t('about.eraseAll'),
          destructive: true,
          onPress: () => {
            haptics.warning();
            setConfirming(true);
          },
        },
      ],
    });
    return list;
  }, [activityCount, activityList.isLoading, appId, counts, provider, routines.length, routinesLoading, schema, t, themeMode, unitSystem, version]);

  return (
    <>
      <ScreenHeader title={t('about.title')} largeTitle />
      <SettingsList sections={sections} />
      {confirming ? (
        <ConfirmDialog
          visible={!erasing}
          title={t('about.eraseTitle')}
          message={t('about.eraseMessage', {
            activities: t('about.activityCount', { count: activityCount }),
            routines: t('about.routineCount', { count: routines.length }),
          })}
          confirmLabel={t('about.eraseConfirm')}
          cancelLabel={t('about.keepMyData')}
          destructive
          onConfirm={() => void erase()}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/* ----------------------------------------------------------------- helpers -- */

/**
 * The version this install actually migrated to. The read: and why it asks the database
 * instead of importing a constant: lives in `readSchemaVersion` (src/persistence/database.ts);
 * this pins the answer to the first render so the row never flashes 'reading…'.
 */
function useSchemaVersion(): number | null {
  // The read itself lives in the persistence layer (`readSchemaVersion`): this only pins it to
  // the first render, which is the part that is this screen's business.
  const [version] = useState<number | null>(readSchemaVersion);
  return version;
}

/**
 * Per-kind counts in one pass.
 *
 * The accumulator is built out whole rather than from an empty object, so `counts[kind]` is
 * total for every `ActivityKind` and the call sites don't each need a `?? 0` that hides a
 * future kind being missed.
 */
function tally(activities: readonly { kind: ActivityKind }[]): Record<ActivityKind, number> {
  const out: Record<ActivityKind, number> = { run: 0, ride: 0, lift: 0, walk: 0, yoga: 0 };
  for (const activity of activities) out[activity.kind] += 1;
  return out;
}

/** Catalog keys, not words: this is module scope, where there is no language yet. */
const KIND_NAMES: Record<ActivityKind, TKey> = {
  run: 'about.kindRuns',
  ride: 'about.kindRides',
  lift: 'about.kindLift',
  walk: 'about.kindWalks',
  yoga: 'about.kindYoga',
};

/**
 * The provider's own `name` is a machine identifier ('wger'): right for a query key, wrong
 * for a sentence. Mapped here rather than changed at the source: human labels are not the API
 * layer's job, and the identifier namespaces its cache.
 */
const LABELLED_PROVIDERS: Record<string, string> = {
  wger: 'wger Workout Manager',
};
