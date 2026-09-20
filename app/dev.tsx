/**
 * Development console — fault injection and request accounting. `__DEV__` only.
 *
 * ## Why this is app UI rather than a CLI flag or a unit test
 *
 * The QA list for this app requires reaching an API *failure*, an *offline* state and a
 * *slow* response on a real device, and then checking what the app did about it. Without
 * injection there are two ways to get there: turn off Wi-Fi, which also kills the dev
 * server, so the app is un-inspectable at exactly the moment you care; or wait for wger to
 * have a real outage, which is not a test. Unit tests can assert that a query surfaces an
 * error; they cannot show that the error screen is readable at 390pt wide with a thumb near
 * it. See `src/api/devFaults.ts` for why injection is a transport concern rather than a
 * provider swap.
 *
 * ## The count field is load-bearing, not convenience
 *
 * `RETRY_BUDGET` in `src/query/client.ts` retries a server error twice and a 429 three
 * times. Arming *one* failure is therefore invisible — the retry succeeds and no screen ever
 * changes. Someone who reaches for this screen to "see the error state", arms one shot, and
 * sees nothing concludes the error handling is broken. So arming is one tap per kind, and the
 * tap sends one more request than that kind's own retry budget: enough to exhaust it, derived
 * from the budget rather than remembered. That is the only reason the budget is exported at
 * all, and the comment on it says so — a debug screen reading a tuning constant beats a
 * debug screen restating it, which is the sort of fact that quietly rots.
 *
 * ## No "send a request" button
 *
 * Every number in the ledger has to be something the app did on its own. A request fired from
 * here is a request the app would never send, so a count that includes it is evidence about
 * this screen rather than about the app — and once it is in the ledger it cannot be
 * distinguished from the real ones. The fault is armed here and spent in the app, which is
 * also what makes it worth arming: the point is the error state on the screen that hit it, not
 * the fact that a promise can reject.
 *
 * ## No live counters, and no pull-to-refresh either
 *
 * The fault status and the request ledger render from a snapshot taken on focus and after
 * each action — never from a timer. A polling readout on the screen whose purpose is to
 * detect request loops would be a screen generating work on the clock it is measuring.
 * Pull-to-refresh is the same hazard dressed up as a gesture, and it does not communicate
 * that the list is a snapshot; a button labelled "Refresh counters" does.
 *
 * ## Reach
 *
 * Linked from Settings → About while `__DEV__`. The route compiles into a production bundle
 * (expo-router has no conditional routes), so this screen's first line is a `null` return;
 * the entry point is behind the same check, which is what keeps it out of a release build's
 * navigation graph.
 */
import { Fragment, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { DetailScreen } from '@/ui/Screen';
import { Card, Divider, SectionHeader, Stack } from '@/ui/layout';
import { Button } from '@/ui/Button';
import { Stepper } from '@/ui/controls';
import { Txt } from '@/ui/Text';
import { Icon, type IconName } from '@/ui/icons';
import {
  activeFault,
  armFault,
  clearFault,
  faultSummary,
  type FaultKind,
  resetRequestLog,
  requestLog,
} from '@/api/devFaults';
import { RETRY_BUDGET } from '@/query/client';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { haptics, setHapticsEnabled } from '@/services/haptics';
import { clearAllUserData, getDatabase } from '@/persistence';
import { seedIfEmpty } from '@/seed/seed';
import { readSettingsSnapshot } from '@/providers/bootstrap';
import { flushSettings, hydrateSettings } from '@/settings';
import {
  countNoun,
} from '@/utils/format';

const BOTTOM_SPACE = 48;

/**
 * The kinds worth reaching for, in the order someone asks for them: "it broke", "there's no
 * signal", "it hung", "it said slow down", then the two that must never be retried.
 */
const FAULTS: { kind: FaultKind; label: string; blurb: string; icon: IconName }[] = [
  {
    kind: 'server',
    label: 'Server error 500',
    blurb: 'Transient. The client retries twice before giving up.',
    icon: 'warning',
  },
  {
    kind: 'offline',
    label: 'No connection',
    blurb: 'Permanent. Retrying a dead radio is pointless, so it does not.',
    icon: 'offline',
  },
  {
    kind: 'timeout',
    label: 'Timeout',
    blurb: 'Transient. Two retries, then the error state.',
    icon: 'clock',
  },
  {
    kind: 'rate-limit',
    label: 'Rate limit 429',
    blurb: 'Three retries, each waiting the Retry-After it was given.',
    icon: 'lock',
  },
  {
    kind: 'not-found',
    label: 'Not found 404',
    blurb: 'Permanent. No retry budget at all.',
    icon: 'info',
  },
  {
    kind: 'bad-request',
    label: 'Bad request 400',
    blurb: 'Permanent. A bug on our side, not a network fault.',
    icon: 'close',
  },
];

type Notice = { text: string; tone: 'ok' | 'bad' };

export default function DevScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState(() => faultSummary());
  const [armed, setArmed] = useState<FaultKind | null>(() => activeFault()?.kind ?? null);
  const [slowMs, setSlowMs] = useState(4000);
  const [log, setLog] = useState(() => requestLog());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [schema] = useState<number | null>(readSchemaVersion);

  /**
   * Reads the counters. Called on focus and after anything that could change them, never on
   * a timer — see the module header.
   */
  const readCounters = useCallback(() => {
    setStatus(faultSummary());
    setArmed(activeFault()?.kind ?? null);
    setLog(requestLog());
  }, []);

  // A navigation away and back re-reads, which is the point: the app kept sending requests
  // while this screen was offscreen, and the ledger has to admit it.
  useFocusEffect(readCounters);

  /**
   * Arms a kind for long enough to reach the error state: budget + 1. The retries are the
   * requests that succeed *after* a failure, so arming a single failure on a kind with two
   * retries is a request nobody ever sees the consequence of.
   *
   * No notice of its own — the status line above already says what is armed and over how many
   * requests, and restating it in a second line below is two places for one fact to disagree.
   */
  const arm = useCallback(
    (kind: FaultKind) => {
      armFault(kind, RETRY_BUDGET[kind] + 1);
      setNotice(null);
      haptics.selection();
      readCounters();
    },
    [readCounters],
  );

  /** Same reason `arm` has a count: a slow request is a different screen from a failed one. */
  const armSlow = useCallback(() => {
    armFault(null, 1, slowMs);
    setNotice(null);
    haptics.selection();
    readCounters();
  }, [slowMs, readCounters]);

  const stopFault = useCallback(() => {
    clearFault();
    haptics.light();
    setNotice(null);
    readCounters();
  }, [readCounters]);

  const clearLog = useCallback(() => {
    resetRequestLog();
    haptics.light();
    setNotice(null);
    readCounters();
  }, [readCounters]);

  const reseed = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      // Order is the whole trick: each step exists so a later step is not undone by an
      // earlier one's asynchronous tail.
      //   1. In-flight queries first. One still running would write rows back after the
      //      wipe, which is exactly the "my deleted data came back" bug.
      await queryClient.cancelQueries();
      //   2. Settings next. The store persists on a debounce, so a write already in flight
      //      would land *after* the DELETE below and resurrect the pre-wipe preferences.
      await flushSettings();
      await clearAllUserData();
      queryClient.clear();
      const result = await seedIfEmpty();
      // The seed owns two settings (weekly goal, default rest) that its history was built
      // around, and the wipe emptied the settings table — so the store is re-read from disk
      // rather than left holding the values the wipe just invalidated.
      const settings = await readSettingsSnapshot();
      hydrateSettings(settings);
      setHapticsEnabled(settings.hapticsEnabled);
      await queryClient.invalidateQueries();
      setNotice({
        text: result
          ? `Restored ${countNoun(result.activities, 'activity', 'activities')}, ${countNoun(result.routines, 'routine')} and ${countNoun(result.records, 'personal record', 'personal records')}.`
          : 'Nothing was seeded — activity rows were present again before it ran.',
        tone: 'ok',
      });
      haptics.success();
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Reseed failed.',
        tone: 'bad',
      });
      haptics.warning();
    } finally {
      setBusy(false);
      readCounters();
    }
  }, [queryClient, readCounters]);

  if (!__DEV__) return null;

  return (
    <DetailScreen title="Developer">
      {(topInset) => (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topInset + spacing.md, paddingBottom: BOTTOM_SPACE + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Stack gap="xxl" style={styles.body}>
            {/* ------------------------------------------------------ fault status */}
            <View>
              <SectionHeader title="Injected fault" eyebrow="Memory only" />
              <Card>
                <Stack gap="md">
                  <StatusLine
                    icon={armed === null ? 'checkCircle' : 'warning'}
                    tone={armed === null ? 'ok' : 'bad'}
                    text={status ?? 'Nothing armed. Requests go to the network as usual.'}
                  />
                  {armed !== null ? (
                    <Button
                      label="Stop injecting"
                      variant="secondary"
                      size="sm"
                      onPress={stopFault}
                      style={styles.selfEnd}
                    />
                  ) : null}
                  {notice ? <StatusLine icon="info" tone={notice.tone} text={notice.text} /> : null}
                </Stack>
              </Card>
            </View>

            {/* ------------------------------------------------------------- arming */}
            <View>
              <SectionHeader title="Arm a failure" eyebrow="Then open Exercises" />
              <Card>
                <Stack gap="lg">
                  <Txt variant="caption" tone="muted">
                    Each button arms enough failures to exhaust that kind’s retry budget, so one tap
                    is enough to reach an error state. Arming a single request on a transient kind
                    would show nothing at all — the retry succeeds and the screen never changes.
                  </Txt>
                  <Divider inset={0} />
                  {FAULTS.map((fault, index) => (
                    <Fragment key={fault.kind}>
                      {index > 0 ? <Divider inset={0} /> : null}
                      <ActionRow
                        label={fault.label}
                        blurb={fault.blurb}
                        icon={fault.icon}
                        actionLabel={armed === fault.kind ? 'Armed' : 'Arm'}
                        active={armed === fault.kind}
                        onPress={() => arm(fault.kind)}
                      />
                    </Fragment>
                  ))}
                </Stack>
              </Card>
            </View>

            {/* ----------------------------------------------------------- latency */}
            <View>
              <SectionHeader title="Slow, no error" eyebrow="Skeletons" />
              <Card>
                <Stack gap="lg">
                  <Stack gap="sm">
                    <Txt variant="label" tone="muted">
                      Delay the next request
                    </Txt>
                    <Stepper
                      value={slowMs}
                      onChange={setSlowMs}
                      min={500}
                      max={40000}
                      step={500}
                      suffix="ms"
                      label="delay in milliseconds"
                    />
                  </Stack>
                  <Divider inset={0} />
                  <Txt variant="caption" tone="muted">
                    A slow request and a failed one are two different screens, and an error state is
                    no proof that a skeleton is readable. This one succeeds after the delay, so the
                    way out of loading is visible too. Waiting is abortable: abandoning a search
                    cancels the wait instead of leaving a promise to land later.
                  </Txt>
                  <Button
                    label="Delay the next request"
                    variant="secondary"
                    size="sm"
                    onPress={armSlow}
                    style={styles.selfEnd}
                  />
                </Stack>
              </Card>
            </View>

            {/* ------------------------------------------------------ request ledger */}
            <View>
              <SectionHeader
                title="Requests since launch"
                eyebrow={log.total === 0 ? undefined : countNoun(log.total, 'request', 'requests')}
              />
              <Card>
                <Stack gap="md">
                  {log.entries.length === 0 ? (
                    <Txt variant="caption" tone="muted">
                      Nothing sent since this process started. Nothing here sends a request on
                      purpose; go use the app, then come back and refresh.
                    </Txt>
                  ) : (
                    <>
                      {log.entries.map((entry) => (
                        <LedgerRow key={entry.path} path={entry.path} count={entry.count} />
                      ))}
                      <Divider inset={0} />
                      <Txt variant="micro" tone="faint">
                        Grouped by path with query parameters removed, so a query re-firing under new
                        parameters reads as one path with a large count rather than as many paths
                        with a count of one. A number climbing while the app sits still is a loop.
                      </Txt>
                      <Divider inset={0} />
                      <Txt variant="caption" tone="muted">
                        The repeated-request check: open Exercises, note the counts, leave to Home and
                        come back. They must not move — a fresh cache entry is good for five minutes.
                        Typing a new search *should* raise the page count once, not once per
                        keystroke.
                      </Txt>
                    </>
                  )}
                  <View style={styles.ledgerActions}>
                    <Button
                      label="Refresh counters"
                      icon="refresh"
                      variant="quiet"
                      size="sm"
                      onPress={readCounters}
                    />
                    {log.entries.length > 0 ? (
                      <Button label="Reset" variant="quiet" size="sm" onPress={clearLog} />
                    ) : null}
                  </View>
                </Stack>
              </Card>
            </View>

            {/* ------------------------------------------------------------ schema */}
            <View>
              <SectionHeader title="Database" eyebrow="Migration state" />
              <Card>
                <Stack gap="sm">
                  <Txt variant="body">Schema v{schema ?? 'unknown'}</Txt>
                  <Txt variant="micro" tone="faint">
                    The version this install actually migrated to, read from the database rather than
                    from the target constant — which is the only way a failed or half-applied
                    migration would show itself.
                  </Txt>
                </Stack>
              </Card>
            </View>

            {/* ----------------------------------------------------------- history */}
            <View>
              <SectionHeader title="Starter history" eyebrow="Erases first" />
              <Card>
                <Stack gap="lg">
                  <Txt variant="caption" tone="muted">
                    Erases everything and writes the seeded thirteen weeks back — ending in the
                    current week, so Home shows a real streak rather than an empty one — so a
                    destructive QA run is recoverable without reinstalling the app. Settings go with
                    it: the seed owns the weekly goal and default rest its history was built around.
                  </Txt>
                  <Txt variant="micro" tone="faint">
                    Deliberately not offered from About, which leaves the app genuinely empty — a
                    wipe that silently refilled itself would be the most confusing possible outcome
                    of a wipe.
                  </Txt>
                  <Button
                    label={busy ? 'Restoring…' : 'Erase and re-seed'}
                    variant="danger"
                    size="sm"
                    weighty
                    loading={busy}
                    disabled={busy}
                    onPress={() => {
                      if (!busy) void reseed();
                    }}
                    style={styles.selfEnd}
                  />
                </Stack>
              </Card>
            </View>
          </Stack>
        </ScrollView>
      )}
    </DetailScreen>
  );
}

/* ------------------------------------------------------------------ pieces -- */

/**
 * A row that explains itself and offers exactly one action.
 *
 * Local rather than `ActionRow` from `@/ui/Button` because that one is a whole-width
 * navigation row with a trailing chevron; this is a control with a reason attached to it.
 * Bending a navigation row into a button would cost a `trailing` override and a style fight
 * over something this short.
 */
function ActionRow({
  label,
  blurb,
  icon,
  actionLabel,
  active,
  onPress,
}: {
  label: string;
  blurb: string;
  icon: IconName;
  actionLabel: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <Stack gap="xxs" style={{ flex: 1 }}>
        <View style={styles.rowHead}>
          <Icon
            name={icon}
            size={16}
            color={active ? theme.colors.accent : theme.colors.textMuted}
          />
          <Txt variant="strong" color={active ? theme.colors.accent : undefined}>
            {label}
          </Txt>
        </View>
        <Txt variant="micro" tone="faint">
          {blurb}
        </Txt>
      </Stack>
      <Button
        label={actionLabel}
        variant={active ? 'secondary' : 'quiet'}
        size="sm"
        disabled={active}
        onPress={onPress}
      />
    </View>
  );
}

function LedgerRow({ path, count }: { path: string; count: number }) {
  const theme = useAppTheme();
  return (
    <View style={styles.ledger}>
      <Txt variant="monoSm" style={styles.ledgerPath} numberOfLines={1}>
        {path}
      </Txt>
      {/* A repeat is not automatically a bug — a paginated list legitimately sends one
          request per page — so nothing here is red. It is a number to read, not a verdict to
          argue with. Amber means "look at this", not "this failed". */}
      <Txt variant="monoSm" color={count > 3 ? theme.colors.warning : undefined}>
        ×{count}
      </Txt>
    </View>
  );
}

function StatusLine({
  icon,
  text,
  tone,
}: {
  icon: IconName;
  text: string;
  tone: 'ok' | 'bad';
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.statusRow}>
      <Icon
        name={icon}
        size={16}
        color={tone === 'ok' ? theme.colors.success : theme.colors.danger}
        style={styles.statusIcon}
      />
      <Txt variant="caption" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * The version this install actually migrated to.
 *
 * Asked of the database rather than imported as `TARGET_SCHEMA_VERSION`, because the point of
 * printing it is what *this* install has been through — a constant can only report what the
 * code was written against, which is precisely the case that matters (a downgrade, a
 * half-applied migration). Read in a `useState` initialiser rather than an effect so it never
 * flashes 'reading…' on a number that was never in question, and a failure returns `null`
 * instead of throwing in a render path.
 */
function readSchemaVersion(): number | null {
  try {
    const row = getDatabase().getFirstSync<{ user_version?: number }>('PRAGMA user_version;');
    return typeof row?.user_version === 'number' ? row.user_version : null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.xl },
  selfEnd: { alignSelf: 'flex-end' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  statusIcon: { marginTop: 2 },
  ledger: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ledgerPath: { flex: 1 },
  ledgerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
