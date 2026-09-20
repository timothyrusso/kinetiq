/**
 * About — what this build is, where the exercise data comes from, and how to get rid of it.
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
 * first one raises — "what happens to my stuff when it's down?".
 *
 * ## The counts read the list cache, not SQL
 *
 * `useActivityList` with the default params is the *same* query the Activities tab uses —
 * frozen default params, so the key matches — and its raw rows are cached unsorted and
 * ungrouped. Counting them here costs one pass over data the app is already holding. A second
 * query for "how many activities" would be a second source of truth for one number, and the
 * only thing that buys is a way for two screens to disagree.
 *
 * ## Reset
 *
 * A destructive control that says "erase everything" is easy to tap by accident and impossible
 * to undo. `ConfirmSheet` is the app's one confirmation idiom — the same one workout discard
 * uses — and the copy spells out what is destroyed, including the demo history, because
 * "it came back on its own" is the most confusing possible outcome of a wipe.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { DetailScreen } from '@/ui/Screen';
import { Card, Divider, SectionHeader, Stack } from '@/ui/layout';
import { ConfirmSheet } from '@/ui/Sheet';
import { IconButton } from '@/ui/Button';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { getExerciseProvider } from '@/api';
import { clearAllUserData, getDatabase } from '@/persistence';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '@/settings';
import { KIND_ORDER } from '@/domain/display';
import { ACTIVITY_ICON, NavRow } from '@/ui/rows';
import type { ActivityKind } from '@/domain/types';
import { routes } from '@/navigation/nav';
import { useActivityList } from '@/queries/useActivities';
import { useRoutines } from '@/queries/useRoutines';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { haptics } from '@/services/haptics';
import {
  countNoun,
} from '@/utils/format';

const BOTTOM_SPACE = 48;

export default function SettingsAboutScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const provider = getExerciseProvider();
  const config = Constants.expoConfig;
  const version = config?.version ?? null;
  const appId = config?.ios?.bundleIdentifier ?? config?.android?.package ?? config?.slug ?? null;
  const schema = readSchemaVersion();

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
      // Order matters. Data first, then the caches that describe it, then settings last —
      // settings is the one step that writes back to the database, so doing it earlier would
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
    <DetailScreen title="About">
      {(topInset) => (
        <>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topInset + spacing.md, paddingBottom: BOTTOM_SPACE + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Stack gap="xxl" style={styles.body}>
            {/* --------------------------------------------------------- build */}
            <View>
              <SectionHeader title="Kinetiq" eyebrow="Training tracker" />
              <Card padding="md">
                <Fact label="Version" value={version ?? 'unknown'} />
                <Fact label="App ID" value={appId ?? 'unknown'} hint="Worth quoting if something breaks." />
                <Fact label="Database schema" value={`v${schema}`} last />
              </Card>
              <Txt variant="micro" tone="faint" style={styles.footnote}>
                Everything is stored on this device. Kinetiq has no account, no sign-in, and no
                server of its own.
              </Txt>
            </View>

            {/* -------------------------------------------------------- catalog */}
            <View>
              <SectionHeader title="Exercise catalog" eyebrow="Served remotely" />
              <Card>
                <Stack gap="md">
                  <Txt variant="strong">
                    {LABELLED_PROVIDERS[provider.name] ?? provider.name}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    The exercise library — search, photos, muscles and equipment — is served by
                    an external catalog, live.
                  </Txt>
                  <Divider inset={0} />
                  <Txt variant="caption" tone="muted">
                    Your own data never depends on it. Every exercise you add to a routine is
                    stored as a local snapshot, so routines and history keep working when the
                    catalog is offline, rate-limited, or gone.
                  </Txt>
                  {provider.supportsOffline ? null : (
                    <Txt variant="micro" tone="faint">
                      Browsing for new exercises needs a connection. Using the ones you saved
                      does not.
                    </Txt>
                  )}
                </Stack>
              </Card>
            </View>

            {/* ------------------------------------------------------ your data */}
            <View>
              <SectionHeader
                title="On this device"
                eyebrow={
                  activityList.isLoading
                    ? undefined
                    : countNoun(activityCount, 'activity', 'activities')
                }
              />
              <Card padding="md">
                {activityList.isLoading ? (
                  <Fact label="Activities" value="counting…" last />
                ) : activityCount === 0 ? (
                  <View style={styles.empty}>
                    <Txt variant="caption" tone="muted">
                      Nothing stored yet.
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
                  label="Routines"
                  value={routinesLoading ? 'counting…' : String(routines.length)}
                  hint="Each carries its own exercise snapshots."
                />
                <Fact label="Units" value={unitSystem === 'metric' ? 'Metric' : 'Imperial'} />
                <Fact
                  label="Appearance"
                  value={
                    themeMode === 'system'
                      ? 'Match the system'
                      : themeMode === 'light'
                        ? 'Light'
                        : 'Dark'
                  }
                  last
                />
              </Card>
            </View>

            {/* ----------------------------------------------------- dev console
                Compiled into the route table either way — expo-router has no conditional
                routes — so `app/dev.tsx` returns null outside `__DEV__` as well. The link is
                gated here because an entry point is the thing a reviewer or a user sees, and
                a row that leads to a blank screen is worse than no row. */}
            {__DEV__ ? (
              <View>
                <SectionHeader title="Developer" eyebrow="This build only" />
                <Card padding="md">
                  <NavRow
                    title="Fault injection"
                    subtitle="Fail, slow or stall a request, and count what the app then sends"
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
              <SectionHeader title="Reset" eyebrow="Cannot be undone" />
              <Card>
                <View style={styles.resetRow}>
                  <Stack gap="xxs" style={{ flex: 1 }}>
                    <Txt variant="strong">Erase all Kinetiq data</Txt>
                    <Txt variant="caption" tone="muted">
                      {countNoun(activityCount, 'activity', 'activities')} ·{' '}
                      {countNoun(routines.length, 'routine')} · settings
                    </Txt>
                  </Stack>
                  <IconButton
                    name="trash"
                    variant="surface"
                    accessibilityLabel="Erase all Kinetiq data"
                    accessibilityHint="Deletes history and routines after asking first"
                    onPress={() => {
                      haptics.warning();
                      setConfirming(true);
                    }}
                  />
                </View>
                <Divider inset={0} />
                <View style={styles.resetNote}>
                  <Txt variant="micro" tone="faint">
                    Saved exercises came from the catalog and can be downloaded again. Nothing
                    is uploaded anywhere, so there is no account to close and nothing sitting on
                    someone else's server to delete.
                  </Txt>
                </View>
              </Card>
            </View>

            <Txt variant="micro" tone="faint" align="center">
              Built with React Native and Expo.
            </Txt>
          </Stack>
        </ScrollView>
        {confirming ? (
        <ConfirmSheet
          title="Erase everything?"
          message={
            `${countNoun(activityCount, 'activity', 'activities')} and ` +
            `${countNoun(routines.length, 'routine')} will be deleted from this device, along ` +
            'with your units, appearance, goal and reminder settings. You will be left with an ' +
            'empty app — nothing is re-added unless you ask for it below.'
          }
          confirmLabel={erasing ? 'Erasing…' : 'Erase everything'}
          onConfirm={() => {
            if (erasing) return;
            void erase();
          }}
          onRequestClose={() => {
            // Closed while it is already running: the wipe is in flight and cannot be recalled,
            // so dismissing the sheet would hide the only indication that anything is happening.
            if (erasing) return;
            setConfirming(false);
          }}
          cancelLabel="Keep my data"
        />
      ) : null}
        </>
      )}
    </DetailScreen>
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
  const theme = useAppTheme();
  return (
    <View style={styles.fact}>
      {!first ? <Hairline /> : null}
      <View style={styles.factRow}>
        <View style={styles.kindLeft}>
          <Icon name={ACTIVITY_ICON[kind]} size={18} color={theme.colors.textMuted} />
          <Txt variant="body" tone="muted" style={{ marginLeft: spacing.sm }}>
            {KIND_NAMES[kind]}
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
 * The version this install actually migrated to, read from `PRAGMA user_version`.
 *
 * Asked of the database rather than imported as `TARGET_SCHEMA_VERSION`, because the point of
 * printing it is to know what *this* install has been through — a constant could only ever
 * report what the code was written against, which is exactly the case that matters (a downgrade,
 * a partial migration) and the one a constant hides.
 *
 * Read synchronously in a `useState` initialiser: the database is open by the time any screen
 * mounts (bootstrap opened it before the splash came down), the pragma is sub-millisecond, and
 * an effect would flash 'reading…' on a number that was never in question. A failure returns
 * `null` and renders as 'unknown' rather than throwing in a render path.
 */
function readSchemaVersion(): number | null {
  const [version] = useState<number | null>(() => {
    try {
      const row = getDatabase().getFirstSync<{ user_version?: number }>(
        'PRAGMA user_version;',
      );
      return typeof row?.user_version === 'number' ? row.user_version : null;
    } catch {
      return null;
    }
  });
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

const KIND_NAMES: Record<ActivityKind, string> = {
  run: 'Runs',
  ride: 'Rides',
  lift: 'Strength sessions',
  walk: 'Walks',
  yoga: 'Yoga',
};

/**
 * The provider's own `name` is a machine identifier ('wger') — right for a query key, wrong
 * for a sentence. Mapped here rather than changed at the source: human labels are not the API
 * layer's job, and the identifier namespaces its cache.
 */
const LABELLED_PROVIDERS: Record<string, string> = {
  wger: 'wger Workout Manager',
};

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.xl },
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
