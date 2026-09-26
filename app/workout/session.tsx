/**
 * The live workout: the only screen in the app that holds something unfinished.
 *
 * ## The engine owns the truth; this screen owns the asking
 *
 * Every mutation here is a synchronous call into `@/workout/session`, which writes to
 * SQLite before it publishes. Nothing on this screen has pending state, a spinner, or an
 * undo: the write has already landed by the time the press handler returns. What the
 * screen *does* own is the asking: which of the two ways out of here destroy data go
 * through a confirmation, and which do not.
 *
 * ## The clock is a wall, not a stopwatch
 *
 * `elapsedSeconds` is stored as accumulated *foreground* seconds, and the rest timer is an
 * absolute `restEndsAt` deadline. So the screen has no timer of its own to reconcile: the
 * engine ticks once a second and this subscribes. Backgrounding the app, force-quitting it,
 * or a phone call in the middle of a set all resolve to the same number when the app comes
 * back, because none of them involve a `Date.now()` difference computed in JS. The rest
 * timer works the same way: it survives by re-deriving from the deadline, not by counting
 * in a component that may no longer exist.
 *
 * ## Why the rest notification lives here
 *
 * The engine is deliberately free of notification imports: it should not care whether the
 * device is allowed to buzz. But a rest timer with no alert is a rest timer you cannot walk
 * away from, so the screen arms one at the exact moment a rest begins: which is *here*, in
 * the one handler that starts a rest: and retracts it when the user starts the next set
 * early. Arming it in the engine would put a `Permissions`-shaped failure inside a module
 * whose job is arithmetic.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { router, Stack } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ScreenHeader } from '@/ui/Screen';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import {
  addSet,
  clearRest,
  discardSession,
  finishSession,
  pauseSession,
  removeExercise,
  resumeSession,
  setActiveIndex,
  setRestTimer,
  skipExercise,
  toggleSet,
  useRestRemaining,
  useSessionProgress,
  useWorkoutSession,
} from '@/workout/session';
import { invalidateAfterWorkout } from '@/query/invalidation';
import {
  usePreviousPerformance,
  type PreviousLift,
} from '@/queries/useRoutines';
import { haptics, useHaptics } from '@/services/haptics';
import { justReachedWeeklyGoal } from '@/workout/weeklyGoal';
import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';
import {
  cancelScheduledNotification,
  notifyRestComplete,
} from '@/services/notifications';
import { routes } from '@/navigation/nav';
import { useSettings } from '@/settings';
import type { UnitSystem } from '@/utils/format';
import {
  compactNumber,
  formatDurationCompact,
  formatTimer,
  formatWeight,
  weightUnit,
  weightValue,
} from '@/utils/format';
import { formatAgoLocalized } from '@/utils/relativeTime';
import type { TKey, TVars } from '@/i18n';
import { useAppTheme } from '@/theme/theme';
import { spacing, z, screenGutter } from '@/theme/tokens';
import { Button } from '@/ui/controls/Button';
import { IconButton } from '@/ui/controls/IconButton';
import { Card, OverlaySurface, Row } from '@/ui/layout';
import { MetaLine, SectionHeader, StatTile, type MetaItem } from '@/ui/display';
import { Chip } from '@/ui/controls/Chip';
import { Txt } from '@/ui/Text';
import { EmptyState, SkeletonCard } from '@/ui/states';
import { Icon } from '@/ui/icons';
import {
  ExerciseBlock,
  RestDock,
  RemoveExerciseDialog,
  SessionProgressBar,
} from '@/ui/workout';

const KEEP_AWAKE_TAG = 'kinetiq.workout';

export default function WorkoutSessionScreen() {
  const { t, locale } = useT();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();

  const { session, hydrated, persistFailed, awayNoticeSeconds } = useWorkoutSession();
  const progress = useSessionProgress();
  const restRemaining = useRestRemaining();
  const hapticsApi = useHaptics();

  const units = useSettings((s) => s.unitSystem);
  const notificationsOn = useSettings(
    (s) => s.notificationsEnabled && s.notificationsGranted,
  );
  const autoStartRest = useSettings((s) => s.autoStartRest);
  const keepScreenAwake = useSettings((s) => s.keepScreenAwake);

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * How much of the window the footer and the rest dock cover, measured rather than guessed.
   *
   * This used to be a fixed 210, which was right for one font size and one device. Both float
   * over the scroll view, so its last card has to clear whichever reaches higher; measuring
   * them means Dynamic Type and a taller home indicator cannot hide the last card under the
   * Finish button. Set on layout only, never per tick.
   */
  const [footerHeight, setFooterHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);
  const onFooterLayout = useCallback((e: LayoutChangeEvent) => {
    setFooterHeight(Math.round(e.nativeEvent.layout.height));
  }, []);

  /**
   * The identifier of the armed rest notification, so it can be retracted.
   *
   * A ref, not state: it exists purely to hand an id to a later press handler, and putting
   * it in state would re-render a screen that already re-renders once a second for the
   * clock, for no visible reason.
   */
  const restAlertId = useRef<string | null>(null);

  /**
   * Latest session and active index, for handlers that must stay referentially stable.
   *
   * The engine publishes a new snapshot every second while a workout runs. A `useCallback`
   * that closed over `session` would therefore change identity every second, which quietly
   * defeats the `memo` on every `ExerciseBlock` below: the whole list re-rendering on a
   * clock tick is exactly the unnecessary work the review pass would flag. Reading through a
   * ref keeps the callback fixed while still seeing the current session.
   */
  const liveRef = useRef<{ session: typeof session; activeIndex: number }>({
    session: null,
    activeIndex: 0,
  });

  const entryIds = useMemo(
    () => (session?.entries ?? []).map((entry) => entry.exerciseId),
    [session?.entries],
  );
  const previous = usePreviousPerformance(session?.routineId ?? null, entryIds);

  // "Keep screen on" (Training settings): the screen stays lit while this screen is open, so
  // the rest timer is still there when the phone is picked up between sets. Released on leave.
  const hasSession = session !== null;
  useEffect(() => {
    if (!keepScreenAwake || !hasSession) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [keepScreenAwake, hasSession]);

  // The away notice is a one-shot the engine sets when a background stint turns out to
  // have been long enough that "your timer kept running" is worth saying out loud.
  useEffect(() => {
    if (awayNoticeSeconds > 0) hapticsApi.warning();
  }, [awayNoticeSeconds, hapticsApi]);

  /**
   * The exercise the user is on, clamped into range.
   *
   * `activeIndex` is persisted, so a session restored after three exercises were removed
   * could legitimately point past the end. `setActiveIndex` clamps on write, but a row read
   * from disk never went through it: so the clamp belongs here too, and the footer's
   * current exercise must not be a `undefined` crash dressed up as an edge case.
   */
  const activeIndex = Math.min(
    session?.activeIndex ?? 0,
    Math.max(0, (session?.entries.length ?? 1) - 1),
  );

  liveRef.current = { session, activeIndex };

  const retract = restRemaining > 0;

  // The countdown haptics: a tick in each of the last three seconds, then a distinct buzz at
  // zero. Only a rest that ran out gets the second: Skip and "-15 s" to nothing clear
  // `restEndsAt`, a rest that expired keeps it. The end buzz also needs the previous reading
  // to be one of those last seconds, so coming back to the app after the rest ended long ago
  // does not greet the user with a buzz for something that is already over.
  const restEndsAt = session?.restEndsAt ?? null;
  const lastRest = useRef(restRemaining);
  useEffect(() => {
    const before = lastRest.current;
    lastRest.current = restRemaining;
    if (restRemaining >= before) return;
    if (restRemaining > 0 && restRemaining <= 3) haptics.restTick();
    else if (restRemaining === 0 && before <= 3 && restEndsAt !== null) haptics.restOver();
  }, [restEndsAt, restRemaining]);

  const retractRestAlert = useCallback(() => {
    const id = restAlertId.current;
    restAlertId.current = null;
    if (id !== null) void cancelScheduledNotification(id);
  }, []);

  // Deliberately *not* retracted on unmount. Leaving this screen mid-rest: to answer a
  // message, or to look at a previous session: is the case the alert exists for: the rest
  // is still running, and the user is no longer looking at it. Only these retract it: an
  // un-ticked set, a skipped rest, a re-armed rest, finishing, discarding.

  const armRest = useCallback(
    (seconds: number) => {
      setRestTimer(seconds);
      if (!notificationsOn) return;
      const { session: live, activeIndex: index } = liveRef.current;
      if (live === null) return;
      const name = live.entries[index]?.exerciseName ?? t('session.thisSet');
      const next = nextUpLabel(live, index);
      // Fired and forgotten on purpose: a notification that cannot be scheduled is a
      // notification the user does not need told about, and the timer on screen works
      // regardless. The returned id is kept only so the next set can retract it.
      void notifyRestComplete(name, next, seconds).then((id) => {
        // A re-arm can overtake an earlier, slower `await` inside `notifyRestComplete`.
        // Cancel whatever that call scheduled rather than dropping its id on the floor,
        // or a rest the user skipped would still buzz.
        if (restAlertId.current !== null) void cancelScheduledNotification(restAlertId.current);
        restAlertId.current = id;
      });
    },
    [notificationsOn, t],
  );

  const onToggleSetAt = useCallback(
    (entryIndex: number, setIndex: number) => {
      const startedRest = toggleSet(entryIndex, setIndex);
      if (startedRest === null) {
        // Un-ticking: pull back the alert the tick armed, or the phone announces a rest
        // that is no longer happening.
        haptics.light();
        retractRestAlert();
        return;
      }
      haptics.setCompleted();
      if (autoStartRest) armRest(startedRest);
    },
    [armRest, autoStartRest, retractRestAlert],
  );

  const openSet = useCallback((entryIndex: number, setIndex: number) => {
    setActiveIndex(entryIndex);
    router.push(routes.sessionSet(entryIndex, setIndex));
  }, []);

  const onAddSet = useCallback(
    (entryIndex: number) => {
      setActiveIndex(entryIndex);
      addSet(entryIndex);
    },
    [],
  );

  const onSkip = useCallback((entryIndex: number) => {
    skipExercise(entryIndex);
  }, []);

  const onFocus = useCallback((entryIndex: number) => {
    setActiveIndex(entryIndex);
  }, []);

  const discard = useCallback(async () => {
    if (session === null || discarding) return;
    setDiscarding(true);
    retractRestAlert();
    // `error()`, not `warning()`: this is the app refusing to lose something quietly. The
    // haptic fires *before* the await, which is where it belongs: a confirmation buzz
    // after a disk write is a buzz nobody connects to the tap that caused it.
    haptics.error();
    try {
      await discardSession(session.id);
      setConfirmDiscard(false);
      router.back();
    } catch {
      setDiscarding(false);
      setActionError(t('session.discardFailed'));
    }
  }, [discarding, retractRestAlert, session, t]);

  const finish = useCallback(async () => {
    if (session === null || finishing) return;
    setFinishing(true);
    retractRestAlert();
    try {
      const result = await finishSession(session.id);
      invalidateAfterWorkout(client, session.routineId);
      setConfirmFinish(false);
      if (result === null) {
        // Nothing was written. Pretending otherwise would send someone to a history
        // screen that does not contain the workout they just did.
        setActionError(t('session.saveFailed'));
        setFinishing(false);
        return;
      }
      // One signature per finish. A PR's sheet plays its own as it appears, and two designed
      // patterns a few hundred milliseconds apart blur into one long buzz, so a finish with a
      // record leaves the haptic to the sheet. The goal check is one indexed read; a failure
      // falls back to the ordinary finish.
      if (result.personalRecords.length === 0) {
        const closedGoal = await justReachedWeeklyGoal().catch(() => false);
        if (closedGoal) haptics.weeklyGoalReached();
        else haptics.workoutFinished();
      }
      // The finished workout lives in the history on Home now, so that is where this screen
      // goes: `dismissTo` pops the player rather than stacking a second Home on top of it. A
      // PR is then presented over Home as a sheet, not a toast: it is worth stopping for.
      router.dismissTo(routes.home());
      if (result.personalRecords.length > 0) {
        router.push(routes.sessionRecords(result.personalRecords));
      }
    } catch {
      setActionError(t('session.saveFailedKept'));
      setFinishing(false);
    }
  }, [client, finishing, retractRestAlert, session, t]);

  if (!hydrated) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        {/* Headerless while restoring, because what it restores is almost always the live
            workout, which is headerless: a bar that appears and vanishes reads as a glitch. */}
        <ScreenHeader title={t('tabs.workout')} shown={false} />
        <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: screenGutter }}>
          <SkeletonCard lines={3} />
        </View>
      </View>
    );
  }

  if (session === null) {
    // Reachable: a cold `expo-router` deep link, or arriving here after the workout was
    // finished on another screen. It is not an error, so it must not render like one.
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        {/* Still headerless when the session ended HERE: this render lands while the screen
            is being popped, and showing a header on a screen mid-removal crashes Android's
            stack ("ScreenStackFragment added into a non-stack container"). */}
        <ScreenHeader title={t('tabs.workout')} shown={!(discarding || finishing)} />
        {/* An ordinary pushed screen now, so the swipe back works again. Left alone while
            leaving, for the same reason as the header above. */}
        {discarding || finishing ? null : <Stack.Screen options={{ gestureEnabled: true }} />}
        <EmptyState
          title={t('session.noneTitle')}
          message={t('session.noneMessage')}
          icon="workout"
          actionLabel={t('session.pickRoutine')}
          onAction={() => {
            router.replace(routes.workoutTab());
          }}
          style={{ paddingTop: spacing.xxxl }}
        />
      </View>
    );
  }

  const running = session.status === 'active';
  const doneSets = session.entries.reduce(
    (n, entry) => n + entry.sets.filter((set) => set.completed).length,
    0,
  );
  const volumeKg = session.entries.reduce(
    (n, entry) =>
      n + entry.sets.reduce((m, set) => m + (set.completed ? set.reps * set.weightKg : 0), 0),
    0,
  );
  const dockExtent = restRemaining > 0 ? dockHeight + insets.bottom + spacing.md : 0;
  const barMeta: MetaItem[] = [
    {
      id: 'elapsed',
      icon: 'clock',
      label: formatTimer(session.elapsedSeconds),
      a11y: t('workoutFlow.elapsedA11y', { time: formatDurationCompact(session.elapsedSeconds) }),
      mono: true,
    },
    {
      id: 'sets',
      icon: 'layers',
      // The noun agrees with the denominator, not the numerator: "1/18 set" reads as though
      // eighteen sets were one set. `1/1 set` is the only singular case, which is exactly
      // what `progress.planned` gives.
      label: `${doneSets}/${progress.planned} ${t('session.setWord', { count: progress.planned })}`,
      a11y: t('workoutFlow.setsDone', {
        done: doneSets,
        planned: progress.planned,
        word: t('session.setWord', { count: progress.planned }),
      }),
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Immersive: the bar below is the only chrome, and its exits are explicit buttons. */}
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />

      <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
        <OverlaySurface theme={theme} edge="bottom" />
        <Row gap="sm" align="center">
          <IconButton
            name="close"
            variant="surface"
            size={20}
            accessibilityLabel={t('session.leave')}
            accessibilityHint={t('session.leaveHint')}
            onPress={() => {
              router.back();
            }}
          />
          <View style={styles.barTitles}>
            <Txt variant="label" weight="700" numberOfLines={1}>
              {session.routineName}
            </Txt>
            <MetaLine items={barMeta} theme={theme} />
          </View>
          <Chip
            size="sm"
            label={t(running ? 'session.running' : 'session.paused')}
            icon={running ? 'pause' : 'play'}
            onPress={() => {
              if (running) {
                pauseSession();
                // The clock stopping is the thing being confirmed, so the buzz is on that
                // press rather than somewhere downstream.
                haptics.medium();
              } else {
                resumeSession();
                haptics.light();
              }
            }}
          />
          <IconButton
            name="stop"
            variant="danger"
            size={20}
            weighty
            accessibilityLabel={t('session.finishA11y')}
            onPress={() => {
              setConfirmFinish(true);
            }}
          />
        </Row>
        <View style={{ height: spacing.sm }} />
        <SessionProgressBar ratio={progress.ratio} theme={theme} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(footerHeight, dockExtent) + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {persistFailed ? (
          <View style={styles.section}>
            <Card tone="outline" style={{ borderColor: theme.colors.danger }}>
              <Row gap="md" align="center">
                <Icon name="warning" size={20} color={theme.colors.danger} />
                <View style={{ flex: 1 }}>
                  <Txt variant="strong" weight="700">
                    {t('misc.notSaving')}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {t('misc.persistFailedBody')}
                  </Txt>
                </View>
              </Row>
            </Card>
          </View>
        ) : null}

        {actionError !== null ? (
          <View style={styles.section}>
            <Card tone="outline" style={{ borderColor: theme.colors.warning }}>
              <Txt variant="strong" weight="700">
                {t('misc.couldNotSaveThat')}
              </Txt>
              <Txt variant="caption" tone="muted" style={{ marginTop: spacing.xxs }}>
                {actionError}
              </Txt>
            </Card>
          </View>
        ) : null}

        {awayNoticeSeconds > 30 ? (
          <View style={styles.section}>
            <Card tone="sunken">
              <Row gap="md" align="center">
                <Icon name="clock" size={18} color={theme.colors.textMuted} />
                <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
                  {/* The engine stops the clock while the app is away and re-derives rest
                      from its deadline, so both numbers here are statements about stored
                      data rather than a promise about a timer that was ticking. */}
                  {t('session.awayNotice', {
                    time: formatDurationCompact(awayNoticeSeconds),
                  })}
                </Txt>
              </Row>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <Card>
            <SessionTotals
              elapsed={session.elapsedSeconds}
              sets={doneSets}
              planned={progress.planned}
              volumeKg={volumeKg}
              units={units}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title={t('session.exercises')}
            eyebrow={`${session.entries.length} ${t('session.exerciseWord', { count: session.entries.length })}`}
            action={{ label: t('common.add'), onPress: () => {
                  haptics.light();
                  router.push(routes.pickExercise('session'));
                } }}
          />
          {session.entries.length === 0 ? (
            <EmptyState
              title={t('session.emptyTitle')}
              message={t('session.emptyMessage')}
              icon="dumbbell"
              actionLabel={t('session.addAnExercise')}
              onAction={() => {
                haptics.light();
                router.push(routes.pickExercise('session'));
              }}
              compact
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {session.entries.map((entry, entryIndex) => (
                <ExerciseBlock
                  key={`${entry.exerciseId}-${entryIndex}`}
                  entry={entry}
                  entryIndex={entryIndex}
                  targetSetIndex={firstOpenSetIndex(entry)}
                  units={units}
                  theme={theme}
                  isCurrent={entryIndex === activeIndex}
                  {...previousFor(
                    previous.get(entry.exerciseId),
                    previous.isLoading,
                    units,
                    t,
                    locale,
                  )}
                  onOpenSet={openSet}
                  onToggleSet={onToggleSetAt}
                  onAddSet={onAddSet}
                  onSkip={onSkip}
                  onRequestRemove={setRemoving}
                  onFocus={onFocus}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
        onLayout={onFooterLayout}
      >
        {/* Sibling of the buttons, never their parent: a blur that contains them
            re-blurs on every press-state change. */}
        <OverlaySurface theme={theme} />
        <Row gap="md" align="center">
          <Button
            label={t('session.discard')}
            variant="ghost"
            size="md"
            onPress={() => {
              setConfirmDiscard(true);
            }}
          />
          <Button
            label={t('session.finish')}
            variant="primary"
            size="md"
            fullWidth
            loading={finishing}
            weighty
            onPress={() => {
              setConfirmFinish(true);
            }}
          />
        </Row>
      </View>

      {retract ? (
        <RestDock
          remainingSeconds={restRemaining}
          totalSeconds={session.restDurationSeconds ?? restRemaining}
          theme={theme}
          onHeight={setDockHeight}
          onSkip={() => {
            retractRestAlert();
            clearRest();
            haptics.light();
          }}
          onAdjust={(seconds) => {
            // Restarts the deadline rather than nudging a display value: the countdown is
            // derived from `restEndsAt`, so an adjustment that did not move the deadline
            // would snap back on the next tick.
            retractRestAlert();
            // `setRestTimer` floors at 5 seconds: it has no way to say "no rest": so the
            // dock stepping below that has to clear the timer instead, or minus-15s would
            // appear to stop working five seconds short of zero.
            if (seconds < 5) clearRest();
            else setRestTimer(seconds);
            haptics.selection();
          }}
        />
      ) : null}

      {/* ---- Sheets ---- */}

      {confirmDiscard ? (
        <ConfirmDialog
          visible={!discarding}
          title={t('session.discardTitle')}
          message={t('session.discardMessage', { count: doneSets })}
          confirmLabel={t('session.discardConfirm')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={() => {
            void discard();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      ) : null}

      {confirmFinish ? (
        <ConfirmDialog
          visible={!finishing}
          title={t('session.finishTitle')}
          message={
            progress.ratio < 1
              ? t('session.finishPartial', {
                  left: progress.planned - progress.completed,
                  planned: progress.planned,
                  word: t('session.setWord', { count: progress.planned }),
                })
              : t('session.finishAll', { planned: progress.planned })
          }
          confirmLabel={t('session.finishConfirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            void finish();
          }}
          onCancel={() => setConfirmFinish(false)}
        />
      ) : null}

      {removing !== null ? (
        <RemoveExerciseDialog
          exerciseName={session.entries[removing]?.exerciseName ?? t('session.thisExercise')}
          completedSets={session.entries[removing]?.sets.filter((set) => set.completed).length ?? 0}
          onConfirm={() => {
            removeExercise(removing);
            setRemoving(null);
            haptics.medium();
          }}
          onRequestClose={() => setRemoving(null)}
        />
      ) : null}

    </View>
  );
}

/* --------------------------------------------------------------- fragments -- */

/** Elapsed, sets and total volume. The three numbers someone asks for afterwards. */
function SessionTotals({
  elapsed,
  sets,
  planned,
  volumeKg,
  units,
}: {
  elapsed: number;
  sets: number;
  planned: number;
  volumeKg: number;
  units: UnitSystem;
}) {
  const { t } = useT();
  // Three abreast, so the compact numeral: the default one truncates "1h 05m" on a phone.
  return (
    <Row gap="lg" align="start">
      <StatTile label={t('session.elapsed')} value={formatDurationCompact(elapsed)} emphasis="compact" tabular />
      <StatTile label={t('session.sets')} value={`${sets}/${planned}`} emphasis="compact" tabular />
      <StatTile
        label={t('session.volumeIn', { unit: weightUnit(units) })}
        value={compactNumber(weightValue(volumeKg, units))}
        emphasis="compact"
        tabular
      />
    </Row>
  );
}

/* ------------------------------------------------------------------ helpers -- */

/**
 * The first set in this block that is still outstanding.
 *
 * "First unticked" rather than "one past the last ticked", because dropping a middle set
 * and finishing the rest is normal: a bench press where the third set became a phone call
 * should still point at the third set.
 */
function firstOpenSetIndex(entry: {
  sets: { completed: boolean }[];
}): number | null {
  const index = entry.sets.findIndex((set) => !set.completed);
  return index < 0 ? null : index;
}

/**
 * "Last time 82.5 kg × 5" and "3w ago", or the honest alternative.
 *
 * Three distinct answers, because there are three distinct truths: the history query has
 * not answered yet (say nothing, "no previous data" before it has is a lie), it answered
 * and this exercise is genuinely new (say so, since "nothing here yet" is useful), or there
 * is a previous number (say it). The last case is the one that decides whether to add
 * weight, which is why it gets the most detail: heaviest set's load and reps, not a volume
 * figure nobody can act on between sets.
 */
function previousFor(
  lift: PreviousLift | undefined,
  isLoading: boolean,
  units: UnitSystem,
  t: (key: TKey, vars?: TVars) => string,
  locale: string,
): { previousLabel: string | null; previousWhen: string | null } {
  // Two strings rather than the items themselves: `ExerciseBlock` is memoised and this runs on
  // every clock tick, so it has to receive values that compare equal from one second to the
  // next. The block builds its `MetaLine` from them.
  if (lift === undefined) {
    return { previousLabel: isLoading ? null : t('session.noPrevious'), previousWhen: null };
  }
  const heaviest = lift.sets.reduce<(typeof lift.sets)[number] | null>(
    (best, set) => (best === null || set.weightKg > best.weightKg ? set : best),
    null,
  );
  if (heaviest === null) return { previousLabel: t('session.noLoadRecorded'), previousWhen: null };
  const load =
    heaviest.weightKg === 0
      ? t('session.bodyweight')
      : `${formatWeight(heaviest.weightKg, units)} × ${heaviest.reps}`;
  // The "when" half is omitted for a row whose timestamp is unusable.
  const when = Number.isFinite(lift.performedAt) && lift.performedAt > 0
    ? formatAgoLocalized(lift.performedAt, t, locale)
    : null;
  return { previousLabel: t('session.lastTime', { load }), previousWhen: when };
}

/** The body copy for the rest notification: what comes after this set, if anything. */
function nextUpLabel(
  session: NonNullable<ReturnType<typeof useWorkoutSession>['session']>,
  activeIndex: number,
): string {
  const entry = session.entries[activeIndex];
  if (!entry) return '';
  const open = entry.sets.filter((set) => !set.completed);
  // More sets in this exercise, or a later exercise, or genuinely nothing left.
  if (open.length > 1) {
    return tr('session.moreSetsOf', { count: open.length - 1, name: entry.exerciseName });
  }
  const nextEntry = session.entries.slice(activeIndex + 1).find((e) => e.sets.length > 0);
  return nextEntry?.exerciseName ?? '';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing.md,
    // No border here: `OverlaySurface` draws the hairline, and a second one on the
    // same edge reads as a thicker, fuzzier line.
    zIndex: z.sticky,
  },
  barTitles: { flex: 1, minWidth: 0, gap: spacing.xxs },
  content: { flexGrow: 1, paddingTop: spacing.lg },
  section: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl },
  // No `zIndex`: the rest dock is rendered after this and is also `z.sticky`, and the
  // dock must stay on top of the footer. Leaving this at `auto` keeps that ordering
  // unambiguous rather than a tie won by DOM order.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.md,
  },
} satisfies Record<string, ViewStyle>);
