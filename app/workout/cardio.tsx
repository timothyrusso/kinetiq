/**
 * Cardio recording: run, ride, walk, with a route.
 *
 * ## The state lives in `src/services/location`, not here
 *
 * This screen is a view over `recorder`'s external store, exactly like the workout player is a
 * view over the session store. That is not ceremony: a recording outlives this screen. iOS keeps
 * the location subscription alive through `UIBackgroundModes: location`, Android routes fixes
 * through a headless task, and either can deliver a fix while this component is unmounted or the
 * app is suspended. A recorder kept in `useState` would die with the screen and take the activity
 * with it; `recorder` is a module singleton that hydrates its own draft at boot, so an app killed
 * mid-run comes back with the route and the elapsed time intact and offers to resume.
 *
 * ## A denial starts the session anyway
 *
 * `recorder.start()` never refuses: with permission off it records a timed entry and estimates
 * distance from elapsed time. The screen says so in the service's own words (`degradationMessage`)
 * rather than inventing a second description of the same fault: two phrasings of one failure is
 * how a user ends up with two contradictory ideas about it. Refusing to start would be the worse
 * product: someone who has denied location permanently is still allowed to time a run.
 *
 * ## The clock is driven from here, on purpose
 *
 * `recorder` derives `elapsedSeconds` from the wall clock when asked, and only *publishes* on a
 * location fix or a state change. Without the one-second subscription here, a runner standing at a
 * crossing watches a frozen timer. The subscription is torn down on unmount; the recorder keeps its
 * own 12-second persistence flush, which is the only thing that has to survive this screen going
 * away.
 *
 * ## The finish rules belong to the service
 *
 * Under 20 seconds *and* under 50 metres, `finish()` discards and returns `null`. This screen does
 * not restate that threshold: it asks for the activity and, if none came back, says what happened.
 * Copying the number here would eventually mean the two disagree about whether a session exists.
 *
 * ## Why the live panel has no back button
 *
 * The start panel is an ordinary pushed screen. Once a recording is live the chrome changes to a
 * self-contained panel whose only exits are Stop, Discard, and the system gestures: no header, no
 * back chevron, and the swipe-back gesture is off for this route (see `app/workout/_layout.tsx`,
 * same reasoning as the workout session). A large timer under a thumb is the one place where a
 * stray edge swipe must not look like it cancelled six kilometres. What the gestures actually do is
 * said on the panel rather than left to guesswork: leaving *is* supported, the recording keeps
 * running, and returning finishes it.
 *
 * ## Where this cannot be verified
 *
 * On a simulator, fixes come from the debug menu: a fixed point, perfect accuracy, no movement.
 * Distance therefore stays estimated and the route stays a single dot. The `__DEV__` note at the
 * bottom of the start panel says exactly that, because "it does not work here" and "it is broken"
 * are different conclusions, and this screen is the only place either one gets stated.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { useScreenContentBottom } from '@/ui/insets';
import { Card, Divider, MetricGrid, Row, SectionHeader, Stack } from '@/ui/layout';
import { ActionRow } from '@/ui/rows';
import { Button } from '@/ui/controls/Button';
import { Chip } from '@/ui/controls/Chip';
import { MetricLabel, Txt } from '@/ui/Text';
import { Icon, type IconName } from '@/ui/icons';
import { TextField } from '@/ui/TextField';
import { EmptyState } from '@/ui/states';
import { RouteMap } from '@/ui/RouteMap';
import { degradationMessage, recorder } from '@/services/location';
import type { CardioSnapshot } from '@/services/location';
import { invalidateActivityHistory } from '@/query/invalidation';
import { useSettings } from '@/settings';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import type { TKey } from '@/i18n';
import { routes } from '@/navigation/nav';
import type { ActivityKind } from '@/domain/types';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import type { UnitSystem } from '@/utils/format';
import {
  formatCalories,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
} from '@/utils/format';


/**
 * The recorder is an external store. Its `getSnapshot` is throttled to a new object every
 * 250 ms, and `useSyncExternalStore` re-renders on reference change: so that throttle *is* the
 * frame-rate cap, which is what keeps the map from refitting its region 60 times a second.
 *
 * The interval in the live panel exists because the same throttle means nothing is published while
 * the user stands still: elapsed time moves with the wall clock, and a location fix is not what the
 * timer is counting.
 */
function useCardio(): CardioSnapshot {
  return useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
}

/**
 * What can be recorded. Strength training is deliberately absent: there is no route to trace and no
 * honest way to infer a distance from a bench press, so a session with no distance would put a
 * fabricated `0.00 km` into history for the progress charts to average against.
 */
const TRACKABLE: readonly { kind: ActivityKind; label: TKey; icon: IconName }[] = [
  { kind: 'run', label: 'cardio.kindRun', icon: 'run' },
  { kind: 'ride', label: 'cardio.kindRide', icon: 'bike' },
  { kind: 'walk', label: 'cardio.kindWalk', icon: 'walk' },
  { kind: 'yoga', label: 'cardio.kindOther', icon: 'yoga' },
];

export default function CardioScreen() {
  const { t } = useT();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = useScreenContentBottom();
  const client = useQueryClient();
  const cardio = useCardio();

  const units = useSettings((s) => s.unitSystem);
  const showSpeed = useSettings((s) => s.showSpeedInsteadOfPace);

  const [kind, setKind] = useState<ActivityKind>('run');
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  /** Set only by a `finish()` that wrote a row; drives the "Saved" screen. */
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [tooShort, setTooShort] = useState(false);

  // See `useCardio`: one second is the smallest thing the clock displays.
  //
  // The callback has to **render**, not merely fire. `recorder` is an external store, and
  // `useSyncExternalStore` re-reads it only when the store notifies: which happens on a location
  // fix or a state change, never on the wall clock. An interval with an empty body keeps a timer
  // alive that nothing is listening to, and the displayed elapsed time sits at `00:00` for the whole
  // run while the underlying arithmetic is perfectly correct: a freeze like that is invisible to the
  // service's own tests, because the service was never wrong. Hence a counter here rather than a tick
  // the store publishes: elapsed belongs to the wall clock, but *who needs it repainted* is this
  // screen, and no other surface shows a live cardio clock.
  const live = cardio.status === 'running';
  const [, repaintClock] = useState(0);
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => repaintClock((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  const start = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      await recorder.start({
        kind,
        ...(title.trim().length > 0 ? { title: title.trim() } : {}),
      });
      haptics.success();
    } catch (error) {
      // The only thing `start` throws for is a recording already being live, which a double-tap on
      // a slow device can cause. Route rather than explain: the live panel *is* the answer to
      // "where did my run go", and the message behind it would otherwise be a stack of identical
      // panels.
      setStartError(error instanceof Error ? error.message : t('cardio.startFailed'));
      haptics.warning();
      if (recorder.getSnapshot().status !== 'idle') router.replace(routes.cardio());
    } finally {
      setStarting(false);
    }
  }, [kind, starting, t, title]);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    setFinishError(null);
    try {
      const result = await recorder.finish();
      if (result === null) {
        // `finish()` already discarded the draft, so there is nothing to clean up and no row to
        // claim. Say so, rather than showing a "Saved" screen for nothing.
        setTooShort(true);
        haptics.warning();
        return;
      }
      invalidateActivityHistory(client);
      setSavedAs(result.activityId);
      haptics.success();
    } catch {
      // The draft survives a failed save: that is deliberate, in the service: so the right next
      // move is to try again, not to start over.
      setFinishError(t('cardio.saveFailed'));
      haptics.warning();
    } finally {
      setFinishing(false);
    }
  }, [client, finishing, t]);

  const discard = useCallback(() => {
    void recorder.discard();
    setConfirmingDiscard(false);
    haptics.warning();
  }, []);

  if (savedAs !== null) {
    return (
      <Screen style={styles.center}>
        <ScreenHeader title={t('cardio.title')} />
        <EmptyState
          icon="checkCircle"
          title={t('cardio.savedTitle')}
          message={t('cardio.savedMessage')}
          actionLabel={t('cardio.viewActivity')}
          onAction={() => router.replace(routes.activityDetail(savedAs))}
          secondaryLabel={t('cardio.recordAnother')}
          onSecondary={() => {
            setSavedAs(null);
            setTitle('');
          }}
        />
      </Screen>
    );
  }

  if (tooShort) {
    return (
      <Screen style={styles.center}>
        <ScreenHeader title={t('cardio.title')} />
        <EmptyState
          icon="clock"
          title={t('cardio.tooShortTitle')}
          message={t('cardio.tooShortMessage')}
          actionLabel={t('cardio.recordAnother')}
          onAction={() => {
            setTooShort(false);
            setTitle('');
          }}
        />
      </Screen>
    );
  }

  if (cardio.status === 'idle') {
    return (
      <StartPanel
        kind={kind}
        onKind={setKind}
        title={title}
        onTitle={setTitle}
        starting={starting}
        error={startError}
        onStart={() => void start()}
        units={units}
        resumable={cardio.resumable}
        onResume={() => void recorder.recover()}
        onDropResumable={() => void recorder.abandonResumable()}
        bottomSpace={bottomSpace}
      />
    );
  }

  /* -------------------------------------------------------------- live panel */

  const running = cardio.status === 'running';
  const hasRoute = cardio.route.length >= 2;
  const speedMps = cardio.paceSecPerKm > 0 ? 1000 / cardio.paceSecPerKm : 0;
  const useSpeed = showSpeed || cardio.kind === 'ride';

  return (
    <>
      {/* The `Screen` wrapper is not decoration. The root layout keeps `contentStyle`
          transparent so a push does not flash a second background over the outgoing screen,
          which means a route that paints no background of its own lets the previous screen
          show through during the slide. */}
      <Screen>
        {/* Immersive while recording: the exits are Stop and Discard, in content. */}
        <ScreenHeader title={cardio.title} shown={false} />
        <ScrollView contentContainerStyle={styles.liveBody}>
          <Stack gap="xl" style={{ paddingTop: insets.top + spacing.lg }}>
            <Row align="center" gap="md">
              <Stack gap="xxs" style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="micro" tone="faint" uppercase tracking={0.8}>
                  {t(running ? 'cardio.recording' : 'cardio.paused')}
                </Txt>
                <Txt variant="title" numberOfLines={1}>
                  {cardio.title}
                </Txt>
              </Stack>
              <StatusDot running={running} colour={theme.colors.accent} />
            </Row>

            <Card>
              <View style={styles.hero}>
                <Txt variant="numeralLg">{formatDuration(cardio.elapsedSeconds)}</Txt>
                <MetricLabel label={t(running ? 'cardio.elapsed' : 'cardio.paused')} />
              </View>
              <Divider inset={0} />
              <MetricGrid columns={2}>
                <Metric
                  label={t('cardio.distance')}
                  value={formatDistance(cardio.distanceMeters, units, 2)}
                  note={t(
                    cardio.distanceEstimated ? 'cardio.estimatedFromTime' : 'cardio.fromGps',
                  )}
                />
                <Metric
                  label={t(useSpeed ? 'cardio.speed' : 'cardio.pace')}
                  value={
                    useSpeed
                      ? formatSpeed(speedMps, units)
                      : formatPace(cardio.paceSecPerKm, units)
                  }
                />
                <Metric
                  label={t('cardio.calories')}
                  value={`${formatCalories(cardio.caloriesKcal)} kcal`}
                />
                <Metric
                  label={t('cardio.positions')}
                  value={`${cardio.route.length}`}
                  note={hasRoute ? undefined : t('cardio.noRouteYet')}
                />
              </MetricGrid>
            </Card>

            {cardio.degradations.length > 0 ? (
              <Card tone="sunken">
                <Stack gap="sm">
                  <Row gap="sm">
                    <Icon name="warning" size={18} color={theme.colors.warning} />
                    <Txt variant="strong">{t('cardio.limitsTitle')}</Txt>
                  </Row>
                  {/* Every active degradation, not just the first. The service keeps only the first
                      in `degradedReason` because that field is a one-line label; the list is the
                      truth, and "permission off" plus "location services off" is a different problem
                      from either one alone. */}
                  {cardio.degradations.map((reason) => (
                    <Txt key={reason} variant="caption" tone="muted">
                      {degradationMessage(reason)}
                    </Txt>
                  ))}
                  {cardio.permission === 'denied' ? (
                    <Button
                      label={t('cardio.tryLocationAgain')}
                      variant="secondary"
                      size="sm"
                      icon="mapPin"
                      onPress={() => void recorder.requestPermission()}
                      accessibilityHint={t('cardio.tryLocationHint')}
                    />
                  ) : null}
                </Stack>
              </Card>
            ) : null}

            {finishError ? (
              <Txt variant="caption" tone="danger">
                {finishError}
              </Txt>
            ) : null}
            {cardio.lastError ? (
              <Txt variant="caption" tone="warning">
                {cardio.lastError}
              </Txt>
            ) : null}

            <View>
              {/* No eyebrow saying "waiting for a fix": that is the banner's sentence about
                  this fault, and the empty card below says the same thing more usefully (it
                  explains *why* a line needs two positions, and how to feed one on a
                  simulator). A section header with nothing to eyebrow is correct here. */}
              <SectionHeader title={t('cardio.route')} />
              {hasRoute ? (
                <RouteMap
                  route={cardio.route}
                  kind={cardio.kind}
                  theme={theme}
                  height={220}
                  interactive={false}
                />
              ) : (
                <Card tone="sunken">
                  <Row gap="md" align="start">
                    <Icon name="route" size={24} color={theme.colors.textFaint} />
                    <Stack gap="xxs" style={{ flex: 1, minWidth: 0 }}>
                      <Txt variant="strong">{t('cardio.nothingTracedTitle')}</Txt>
                      <Txt variant="caption" tone="muted">
                        {t('cardio.nothingTracedMessage')}
                      </Txt>
                    </Stack>
                  </Row>
                </Card>
              )}
            </View>

            <Stack gap="md">
              {running ? (
                <Button
                  label={t('cardio.pause')}
                  variant="secondary"
                  size="lg"
                  icon="pause"
                  fullWidth
                  onPress={() => {
                    recorder.pause();
                    haptics.medium();
                  }}
                />
              ) : (
                <Button
                  label={t('cardio.resume')}
                  variant="secondary"
                  size="lg"
                  icon="play"
                  fullWidth
                  onPress={() => {
                    recorder.resume();
                    haptics.medium();
                  }}
                />
              )}
              <Button
                label={t(finishing ? 'cardio.saving' : 'cardio.stopAndSave')}
                variant="primary"
                size="lg"
                icon="stop"
                fullWidth
                weighty
                loading={finishing}
                onPress={() => void finish()}
                accessibilityHint={t('cardio.stopHint')}
              />
              <ActionRow
                title={t('cardio.discardRow')}
                subtitle={t('cardio.discardRowSubtitle')}
                icon="trash"
                tone="danger"
                onPress={() => setConfirmingDiscard(true)}
              />
            </Stack>

            {/* Said rather than assumed: there is no back button here, so the panel has to say that
                stepping away is allowed and costs nothing. */}
            <Txt variant="caption" tone="muted" align="center">
              {t('cardio.steppingAway')}
            </Txt>

            {__DEV__ ? (
              <Txt variant="micro" tone="faint">
                {t('cardio.devLive')}
              </Txt>
            ) : null}

            <View style={{ height: bottomSpace }} />
          </Stack>
        </ScrollView>
      </Screen>

      {confirmingDiscard ? (
        <ConfirmDialog
          visible={!finishing}
          title={t('cardio.discardTitle')}
          message={t('cardio.discardMessage')}
          confirmLabel={t('cardio.discard')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={discard}
          onCancel={() => setConfirmingDiscard(false)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ start -- */

/**
 * The pre-recording panel.
 *
 * Deliberately not a modal sheet over a list: there is nothing behind it worth seeing, and a sheet
 * would put the start button one dismiss-gesture away from the timer it is about to start. Type and
 * name are chosen where they will be used, so changing your mind five seconds in means staying on
 * one screen.
 */
function StartPanel({
  kind,
  onKind,
  title,
  onTitle,
  starting,
  error,
  onStart,
  units,
  resumable,
  onResume,
  onDropResumable,
  bottomSpace,
}: {
  kind: ActivityKind;
  onKind: (next: ActivityKind) => void;
  title: string;
  onTitle: (next: string) => void;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  units: UnitSystem;
  resumable: CardioSnapshot['resumable'];
  onResume: () => void;
  onDropResumable: () => void;
  bottomSpace: number;
}) {
  const { t } = useT();
  const theme = useAppTheme();

  return (
    <>
      <ScreenHeader title={t('cardio.title')} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.lg, paddingBottom: bottomSpace },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack gap="xxl" style={styles.body}>
          {/* An interrupted recording, adopted from the persisted draft at boot. Offered at the
              top because it is the one thing here that is time-sensitive: every minute spent
              deciding is a minute the route cannot recover. */}
          {resumable ? (
            <Card tone="accent">
              <Stack gap="sm">
                <Txt variant="micro" uppercase tracking={0.8}>
                  {t('cardio.resumableEyebrow')}
                </Txt>
                <Txt variant="caption">
                  {t('cardio.resumableMessage', { name: resumable.title })}
                </Txt>
                <Row gap="md">
                  <Button
                    label={t('cardio.resume')}
                    variant="primary"
                    size="sm"
                    icon="play"
                    onPress={onResume}
                  />
                  <Button
                    label={t('cardio.discardIt')}
                    variant="quiet"
                    size="sm"
                    onPress={onDropResumable}
                  />
                </Row>
              </Stack>
            </Card>
          ) : null}

          <View>
            <SectionHeader title={t('cardio.activity')} eyebrow={t('cardio.activityEyebrow')} />
            <Row gap="sm" wrap>
              {TRACKABLE.map((option) => (
                <Chip
                  key={option.kind}
                  label={t(option.label)}
                  icon={option.icon}
                  selected={kind === option.kind}
                  onPress={() => onKind(option.kind)}
                />
              ))}
            </Row>
          </View>

          <TextField
            label={t('cardio.nameLabel')}
            value={title}
            onChangeText={onTitle}
            placeholder={t(placeholderFor(kind))}
            autoCapitalize="sentences"
            returnKeyType="done"
            accessibilityLabel={t('cardio.nameA11y')}
            hint={t('cardio.nameHint')}
          />

          <View>
            <SectionHeader title={t('cardio.beforeYouStart')} />
            <Card>
              <Stack gap="md">
                <Row gap="md" align="start">
                  <Icon name="mapPin" size={18} color={theme.colors.textMuted} />
                  <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
                    {t('cardio.locationNote', {
                      unit: t(units === 'metric' ? 'cardio.kilometres' : 'cardio.miles'),
                    })}
                  </Txt>
                </Row>
                <Divider inset={0} />
                <Row gap="md" align="start">
                  <Icon name="clock" size={18} color={theme.colors.textMuted} />
                  <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
                    {t('cardio.backgroundNote')}
                  </Txt>
                </Row>
              </Stack>
            </Card>
          </View>

          {error ? (
            <Txt variant="caption" tone="danger">
              {error}
            </Txt>
          ) : null}

          <Button
            label={t(starting ? 'cardio.starting' : 'cardio.start')}
            variant="primary"
            size="lg"
            icon="play"
            fullWidth
            weighty
            loading={starting}
            onPress={onStart}
            accessibilityHint={t('cardio.startHint')}
          />

          {__DEV__ ? (
            <Txt variant="micro" tone="faint">
              {t('cardio.devStart')}
            </Txt>
          ) : null}
        </Stack>
      </ScrollView>
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Stack gap="xxs">
      <MetricLabel label={label} />
      <Txt variant="numeralSm" numberOfLines={1}>
        {value}
      </Txt>
      {note ? (
        <Txt variant="micro" tone="faint" numberOfLines={1}>
          {note}
        </Txt>
      ) : null}
    </Stack>
  );
}

/**
 * The recording indicator. Pulses while live and holds steady while paused, because a steady dot
 * beside a frozen clock is how a user tells "paused" from "crashed": and the two must never look
 * the same from across the room, which is roughly where a phone is when it is in a pocket.
 *
 * Local state and a local interval, so the blink never re-renders the metrics next to it.
 */
function StatusDot({ running, colour }: { running: boolean; colour: string }) {
  const { t } = useT();
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!running) {
      setOn(true);
      return undefined;
    }
    const id = setInterval(() => setOn((v) => !v), 900);
    return () => clearInterval(id);
  }, [running]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t(running ? 'cardio.a11yRecording' : 'cardio.a11yPaused')}
      style={[
        styles.dot,
        { backgroundColor: running ? colour : 'transparent', borderColor: colour },
        on ? null : styles.dotDim,
      ]}
    />
  );
}

/** The catalog key for the name field's placeholder. Translated at the call site. */
function placeholderFor(kind: ActivityKind): TKey {
  if (kind === 'ride') return 'cardio.placeholderRide';
  if (kind === 'walk') return 'cardio.placeholderWalk';
  if (kind === 'yoga') return 'cardio.placeholderOther';
  return 'cardio.placeholderRun';
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: screenGutter },
  center: { flex: 1, justifyContent: 'center' },
  liveBody: { paddingHorizontal: screenGutter },
  hero: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.xxs },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  dotDim: { opacity: 0.35 },
});
