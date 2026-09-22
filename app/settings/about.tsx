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
import { ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useScreenContentBottom } from '@/ui/insets';
import { useQueryClient } from '@tanstack/react-query';

import { ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { Card, Divider, SectionHeader, Stack } from '@/ui/layout';
import { IconButton } from '@/ui/controls/IconButton';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { getExerciseProvider } from '@/api';
import { clearAllUserData, readSchemaVersion } from '@/persistence';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '@/settings';
import { KIND_ORDER } from '@/domain/display';
import { ACTIVITY_ICON, NavRow } from '@/ui/rows';
import type { ActivityKind } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useActivityList } from '@/queries/useActivities';
import { useRoutines } from '@/queries/useRoutines';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';
import {
} from '@/utils/format';


export default function SettingsAboutScreen() {
  const { t } = useT();
  const bottomSpace = useScreenContentBottom();
  const queryClient = useQueryClient();

  const provider = getExerciseProvider();
  const config = Constants.expoConfig;
  const version = config?.version ?? null;
  const appId = config?.ios?.bundleIdentifier ?? config?.android?.package ?? config?.slug ?? null;
  const schema = useSchemaVersion();

  const theme = useAppTheme();
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

  return (
    <>
      <ScreenHeader title={t('about.title')} largeTitle />
      <>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.md, paddingBottom: bottomSpace },
        ]}
        // `automatic`, so iOS owns the inset under the large title and can collapse it as
        // this view scrolls. Without it the title stays large forever and the screen looks
        // like a native header that does not work.
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Stack gap="xxl" style={styles.body}>
          {/* --------------------------------------------------------- build */}
          <View>
            <SectionHeader title="Kinetiq" eyebrow={t('about.appEyebrow')} />
            <Card padding="md">
              <Fact label={t('about.version')} value={version ?? t('about.unknown')} />
              <Fact
                label={t('about.appId')}
                value={appId ?? t('about.unknown')}
                hint={t('about.appIdHint')}
              />
              <Fact label={t('about.schema')} value={`v${schema}`} last />
            </Card>
            <Txt variant="micro" tone="faint" style={styles.footnote}>
              {t('about.storageNote')}
            </Txt>
          </View>

          {/* -------------------------------------------------------- catalog */}
          <View>
            <SectionHeader title={t('about.catalog')} eyebrow={t('about.servedRemotely')} />
            <Card>
              <Stack gap="md">
                <Txt variant="strong">
                  {LABELLED_PROVIDERS[provider.name] ?? provider.name}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {t('about.catalogNote')}
                </Txt>
                <Divider inset={0} />
                <Txt variant="caption" tone="muted">
                  {t('about.localNote')}
                </Txt>
                {provider.supportsOffline ? null : (
                  <Txt variant="micro" tone="faint">
                    {t('about.needsConnection')}
                  </Txt>
                )}
              </Stack>
            </Card>
          </View>

          {/* ------------------------------------------------------ your data */}
          <View>
            <SectionHeader
              title={t('about.onThisDevice')}
              eyebrow={
                activityList.isLoading
                  ? undefined
                  : t('about.activityCount', { count: activityCount })
              }
            />
            <Card padding="md">
              {activityList.isLoading ? (
                <Fact label={t('about.activities')} value={t('about.counting')} last />
              ) : activityCount === 0 ? (
                <View style={styles.empty}>
                  <Txt variant="caption" tone="muted">
                    {t('about.nothingStored')}
                  </Txt>
                </View>
              ) : (
                KIND_ORDER.filter((kind) => (counts[kind] ?? 0) > 0).map((kind, index) => (
                  <KindRow
                    key={kind}
                    kind={kind}
                    count={counts[kind] ?? 0}
                    first={index === 0}
                  />
                ))
              )}
              <Divider inset={0} />
              <Fact
                label={t('about.routines')}
                value={routinesLoading ? t('about.counting') : String(routines.length)}
                hint={t('about.routinesHint')}
              />
              <Fact
                label={t('about.units')}
                value={t(unitSystem === 'metric' ? 'settings.metric' : 'settings.imperial')}
              />
              <Fact
                label={t('about.appearance')}
                value={t(
                  themeMode === 'system'
                    ? 'about.matchSystem'
                    : themeMode === 'light'
                      ? 'settings.light'
                      : 'settings.dark',
                )}
                last
              />
            </Card>
          </View>

          {/* ----------------------------------------------------- dev console
              Compiled into the route table either way: expo-router has no conditional
              routes: so `app/dev.tsx` returns null outside `__DEV__` as well. The link is
              gated here because an entry point is the thing a reviewer or a user sees, and
              a row that leads to a blank screen is worse than no row. */}
          {__DEV__ ? (
            <View>
              <SectionHeader title={t('about.developer')} eyebrow={t('about.thisBuildOnly')} />
              <Card padding="md">
                <NavRow
                  title={t('about.faultInjection')}
                  subtitle={t('about.faultSubtitle')}
                  icon="bolt"
                  topDivider={false}
                  theme={theme}
                  onPress={() => router.push(routes.dev())}
                />
              </Card>
            </View>
          ) : null}

          {/* ---------------------------------------------------------- reset */}
          <View>
            <SectionHeader title={t('about.reset')} eyebrow={t('about.cannotUndo')} />
            <Card>
              <View style={styles.resetRow}>
                <Stack gap="xxs" style={{ flex: 1 }}>
                  <Txt variant="strong">{t('about.eraseAll')}</Txt>
                  <Txt variant="caption" tone="muted">
                    {t('about.activityCount', { count: activityCount })} ·{' '}
                    {t('about.routineCount', { count: routines.length })} ·{' '}
                    {t('about.settingsWord')}
                  </Txt>
                </Stack>
                <IconButton
                  name="trash"
                  variant="surface"
                  accessibilityLabel={t('about.eraseAll')}
                  accessibilityHint={t('about.eraseHint')}
                  onPress={() => {
                    haptics.warning();
                    setConfirming(true);
                  }}
                />
              </View>
              <Divider inset={0} />
              <View style={styles.resetNote}>
                <Txt variant="micro" tone="faint">
                  {t('about.eraseNote')}
                </Txt>
              </View>
            </Card>
          </View>

          <Txt variant="micro" tone="faint" align="center">
            {t('about.builtWith')}
          </Txt>
        </Stack>
      </ScrollView>
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
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * A hairline-separated label/value line inside a card that has already done the padding.
 *
 * `last` suppresses its own top rule rather than filtering an array: a rule between rows is a
 * property of the row above it, and `index > 0` at four call sites is four chances to get the
 * comparison backwards.
 */
function Fact({
  label,
  value,
  hint,
  last = false,
}: {
  label: string;
  value: string;
  hint?: string;
  last?: boolean;
}) {
  return (
    <View style={styles.fact}>
      {!last ? <Hairline /> : null}
      <View style={styles.factRow}>
        <Txt variant="body" tone="muted">
          {label}
        </Txt>
        <Txt variant="strong">{value}</Txt>
      </View>
      {hint ? (
        <Txt variant="micro" tone="faint">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

function KindRow({ kind, count, first }: { kind: ActivityKind; count: number; first: boolean }) {
  const { t } = useT();
  const theme = useAppTheme();
  return (
    <View style={styles.fact}>
      {!first ? <Hairline /> : null}
      <View style={styles.factRow}>
        <View style={styles.kindLeft}>
          <Icon name={ACTIVITY_ICON[kind]} size={18} color={theme.colors.textMuted} />
          <Txt variant="body" tone="muted" style={{ marginLeft: spacing.sm }}>
            {t(KIND_NAMES[kind])}
          </Txt>
        </View>
        <Txt variant="numeralSm">{count}</Txt>
      </View>
    </View>
  );
}

function Hairline() {
  const theme = useAppTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.hairline }} />
  );
}

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

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: screenGutter },
  footnote: { marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  fact: { gap: spacing.xxs },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  kindLeft: { flexDirection: 'row', alignItems: 'center' },
  empty: { paddingVertical: spacing.sm },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  resetNote: { paddingTop: spacing.sm },
});
