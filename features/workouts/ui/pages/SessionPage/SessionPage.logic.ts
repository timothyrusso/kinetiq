import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MetaItem } from '@/features/core/design-system';
import { haptics, useHaptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { screenGutter, spacing } from '@/features/core/theme';
import { type TKey, type TVars, useT } from '@/features/core/translations';
import { formatAgoLocalized, formatDurationCompact, formatTimer, type UnitSystem } from '@/features/core/utils';
import { useAskNotificationPermissionOnce, useRestAlertsOff } from '@/features/notifications';
import { useSettings } from '@/features/settings';
import type { PreviousLift } from '@/features/workouts/domain/entities/PreviousLift';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { sessionActions, useActiveSession } from '@/features/workouts/facades/useActiveSession';
import { useDiscardSession } from '@/features/workouts/facades/useDiscardSession';
import { useKeepScreenAwake } from '@/features/workouts/facades/useKeepScreenAwake';
import { usePreviousPerformance } from '@/features/workouts/facades/usePreviousPerformance';
import { useRestTimer } from '@/features/workouts/facades/useRestTimer';
import { useSessionProgress } from '@/features/workouts/hooks/useSessionProgress';
import { lastTimeValue } from '@/features/workouts/mappers/lastTimeValue';
import type { RestAlertsNotice } from '@/features/workouts/ui/components/RestDock/RestDock.logic';

/** A background stint longer than this is worth saying out loud. */
const AWAY_NOTICE_SECONDS = 30;

type Translate = (key: TKey, vars?: TVars) => string;

/** One exercise block as the screen draws it: values that compare equal from one tick to the next. */
interface BlockRow {
  readonly key: string;
  readonly entry: StrengthEntry;
  readonly entryIndex: number;
  readonly targetSetIndex: number | null;
  readonly previousLabel: string | null;
  readonly previousWhen: string | null;
  readonly isCurrent: boolean;
}

/**
 * The first set of a block still outstanding: the first unticked rather than one past the last
 * ticked, because dropping a middle set and finishing the rest is normal.
 */
function firstOpenSetIndex(entry: StrengthEntry): number | null {
  const index = entry.sets.findIndex(set => !set.completed);
  return index < 0 ? null : index;
}

/**
 * "Last time 82.5 kg × 5" and "3w ago", or the honest alternative. Three truths: the history has
 * not answered yet (say nothing: "no previous data" before it has would be a lie), the exercise
 * is genuinely new (say so), or there is a previous number, and then the best set in the terms
 * that workout recorded: the heaviest load and its reps, which is what decides whether to add
 * weight; the most reps; or the longest hold.
 */
function previousFor(
  lift: PreviousLift | undefined,
  isLoading: boolean,
  units: UnitSystem,
  t: Translate,
  locale: string,
): { previousLabel: string | null; previousWhen: string | null } {
  if (lift === undefined) return { previousLabel: isLoading ? null : t('session.noPrevious'), previousWhen: null };
  const value = lastTimeValue(lift, units);
  if (value === null) return { previousLabel: t('session.noSetsRecorded'), previousWhen: null };
  const when =
    Number.isFinite(lift.performedAt) && lift.performedAt > 0 ? formatAgoLocalized(lift.performedAt, t, locale) : null;
  return { previousLabel: t('session.lastTime', { value }), previousWhen: when };
}

/**
 * The live workout: the only screen that holds something unfinished.
 *
 * The session owns the truth and this screen owns the asking: every change is a call into the
 * session, published at once and written behind it, with no pending state and no undo; what the
 * screen decides is which of the two ways out that destroy data go through a confirmation. The
 * clock is the session's, counted from stored time and an absolute rest deadline, so nothing
 * here keeps a timer to reconcile after a background, a force-quit or a phone call.
 *
 * Every handler handed to a block is stable: the session republishes every second, and a handler
 * that closed over it would re-render every block on each tick.
 */
export function useSessionPageLogic() {
  const { t, locale } = useT();
  const insets = useSafeAreaInsets();
  const hapticsApi = useHaptics();
  // NOTE: the finish runs in its own sheet over this screen, which hears it through `finishing`.
  const { session, hydrated, persistFailed, awayNoticeSeconds, finishing } = useActiveSession();
  const progress = useSessionProgress(session);
  const rest = useRestTimer(session);
  const discardSession = useDiscardSession();

  const units = useSettings(settings => settings.unitSystem);
  const autoStartRest = useSettings(settings => settings.autoStartRest);
  const keepScreenAwake = useSettings(settings => settings.keepScreenAwake);

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // NOTE: how much of the window the footer and the rest dock cover, measured rather than guessed,
  // so Dynamic Type and a taller home indicator cannot hide the last card; set on layout only.
  const [footerHeight, setFooterHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);

  const entries = session?.entries;
  const entryIds = useMemo(() => (entries ?? []).map(entry => entry.exerciseId), [entries]);
  const previous = usePreviousPerformance(session?.routineId ?? null, entryIds);

  // NOTE: "keep screen on" holds while this screen is open, so the rest timer is still there when
  // the phone is picked up between sets; released on leave.
  useKeepScreenAwake(keepScreenAwake && session !== null);

  // NOTE: this screen is where every workout lands (from a routine, empty, or resumed), so it is
  // where the rest alert's permission is asked for, once, while the system can still ask.
  useAskNotificationPermissionOnce(session !== null);
  const { reason: alertsOffReason, openSystemSettings } = useRestAlertsOff();
  const restAlertsOff = useMemo<RestAlertsNotice | null>(() => {
    if (alertsOffReason === null) return null;
    const label = t('setRow.restAlertsOff');
    return {
      meta: [{ id: 'alertsOff', icon: 'bellOff', label }],
      action: t(alertsOffReason === 'switch' ? 'setRow.restAlertsTurnOn' : 'setRow.restAlertsSettings'),
      hint: t(alertsOffReason === 'switch' ? 'setRow.restAlertsTurnOnHint' : 'setRow.restAlertsSettingsHint'),
    };
  }, [alertsOffReason, t]);
  // NOTE: the app's own switch lives in Profile > Notifications; a refusal only the system can undo.
  const fixRestAlerts = useCallback(() => {
    if (alertsOffReason === 'switch') router.push(routes.settingsNotifications());
    else openSystemSettings();
  }, [alertsOffReason, openSystemSettings]);

  useEffect(() => {
    if (awayNoticeSeconds > 0) hapticsApi.warning();
  }, [awayNoticeSeconds, hapticsApi]);

  // NOTE: `activeIndex` is stored, and a row read back from disk never went through the clamp, so
  // a restored session can point past its last exercise.
  const activeIndex = Math.min(session?.activeIndex ?? 0, Math.max(0, (entries?.length ?? 1) - 1));

  const blocks = useMemo<readonly BlockRow[]>(
    () =>
      (entries ?? []).map((entry, entryIndex) => ({
        key: `${entry.exerciseId}-${entryIndex}`,
        entry,
        entryIndex,
        targetSetIndex: firstOpenSetIndex(entry),
        isCurrent: entryIndex === activeIndex,
        ...previousFor(previous.get(entry.exerciseId), previous.isLoading, units, t, locale),
      })),
    [activeIndex, entries, locale, previous, t, units],
  );

  const { retract, start: startRest } = rest;
  const toggleSet = useCallback(
    (entryIndex: number, setIndex: number) => {
      const startedRest = sessionActions.toggleSet(entryIndex, setIndex);
      if (startedRest === null) {
        // NOTE: unticking pulls back the alert the tick armed, or the phone announces a rest that
        // is no longer happening.
        haptics.light();
        retract();
        return;
      }
      haptics.setCompleted();
      // NOTE: a rest of zero is the exercise's "no rest", as its editor says, not the timer's
      // five-second floor.
      if (autoStartRest && startedRest > 0) startRest(startedRest, entryIndex);
    },
    [autoStartRest, retract, startRest],
  );

  // NOTE: both open the exercise's sheet and make it current; a set cell names the set to
  // highlight in it.
  const openSet = useCallback((entryIndex: number, setIndex: number) => {
    sessionActions.focus(entryIndex);
    router.push(routes.sessionExercise(entryIndex, setIndex));
  }, []);
  const openExercise = useCallback((entryIndex: number) => {
    sessionActions.focus(entryIndex);
    router.push(routes.sessionExercise(entryIndex));
  }, []);

  const addSet = useCallback((entryIndex: number) => {
    sessionActions.focus(entryIndex);
    sessionActions.addSet(entryIndex);
  }, []);

  const leave = useCallback(() => router.back(), []);

  const running = session?.status === 'active';
  const togglePause = useCallback(() => {
    if (running) {
      sessionActions.pause();
      // NOTE: the clock stopping is what is being confirmed, so the buzz is on this press.
      haptics.medium();
    } else {
      sessionActions.resume();
      haptics.light();
    }
  }, [running]);

  const addExercise = useCallback(() => {
    haptics.light();
    router.push(routes.pickExercise('session'));
  }, []);

  const pickRoutine = useCallback(() => router.replace(routes.workoutTab()), []);

  const { mutate: discardMutate } = discardSession;
  const discard = useCallback(() => {
    if (session === null || discarding) return;
    setDiscarding(true);
    retract();
    // NOTE: `error()`, not `warning()`: the app refusing to lose something quietly, and before the
    // write, where the buzz still belongs to the tap that caused it.
    haptics.error();
    discardMutate(session.id, {
      onSuccess: () => {
        setConfirmDiscard(false);
        router.back();
      },
      onError: () => {
        setDiscarding(false);
        setActionError(t('session.discardFailed'));
      },
    });
  }, [discardMutate, discarding, retract, session, t]);

  // NOTE: a finish ends the rest early, so the alert its tick armed is pulled back.
  useEffect(() => {
    if (finishing) retract();
  }, [finishing, retract]);

  const askFinish = useCallback(() => router.push(routes.sessionFinish()), []);
  const askDiscard = useCallback(() => setConfirmDiscard(true), []);
  const cancelDiscard = useCallback(() => setConfirmDiscard(false), []);
  const cancelRemove = useCallback(() => setRemoving(null), []);
  const confirmRemove = useCallback(() => {
    if (removing === null) return;
    sessionActions.removeExercise(removing);
    setRemoving(null);
    haptics.medium();
  }, [removing]);

  const footerLayout = useCallback((event: LayoutChangeEvent) => {
    setFooterHeight(Math.round(event.nativeEvent.layout.height));
  }, []);

  const restShown = rest.remaining > 0;
  // NOTE: the dock stands on the footer, never over it, so Finish and Discard stay reachable while
  // a rest runs; the footer's measured height already holds the home indicator.
  const dockBottom = footerHeight + spacing.sm;
  const contentPadding = (restShown ? dockBottom + dockHeight : footerHeight) + spacing.xl;
  const contentInset = useMemo(() => ({ paddingBottom: contentPadding }), [contentPadding]);
  const barInset = useMemo(() => ({ paddingTop: insets.top + spacing.xs }), [insets.top]);
  const footerInset = useMemo(() => ({ paddingBottom: insets.bottom + spacing.md }), [insets.bottom]);
  const restoringInset = useMemo(
    () => ({ paddingTop: insets.top + spacing.xl, paddingHorizontal: screenGutter }),
    [insets.top],
  );

  const elapsed = session?.elapsedSeconds ?? 0;
  const setWord = t('session.setWord', { count: progress.planned });
  // NOTE: the noun agrees with the denominator: "1/18 set" reads as though eighteen sets were one.
  const barMeta = useMemo<MetaItem[]>(
    () => [
      {
        id: 'elapsed',
        icon: 'clock',
        label: formatTimer(elapsed),
        a11y: t('workoutFlow.elapsedA11y', { time: formatDurationCompact(elapsed) }),
        mono: true,
      },
      {
        id: 'sets',
        icon: 'layers',
        label: `${progress.completed}/${progress.planned} ${setWord}`,
        a11y: t('workoutFlow.setsDone', { done: progress.completed, planned: progress.planned, word: setWord }),
      },
    ],
    [elapsed, progress.completed, progress.planned, setWord, t],
  );

  const entryCount = entries?.length ?? 0;
  const removingEntry = removing === null ? undefined : entries?.[removing];

  return {
    state: {
      session,
      hydrated,
      persistFailed,
      actionError,
      units,
      confirmDiscard,
      removing,
      finishing,
      discarding,
      restRemaining: rest.remaining,
      restTotal: rest.total,
    },
    derived: {
      running,
      blocks,
      progress,
      barMeta,
      restShown,
      restAlertsOff,
      dockBottom,
      showAwayNotice: awayNoticeSeconds > AWAY_NOTICE_SECONDS,
      awayNotice: t('session.awayNotice', { time: formatDurationCompact(awayNoticeSeconds) }),
      exercisesEyebrow: `${entryCount} ${t('session.exerciseWord', { count: entryCount })}`,
      discardMessage: t('session.discardMessage', { count: progress.completed }),
      removingName: removingEntry?.exerciseName ?? t('session.thisExercise'),
      removingSets: removingEntry?.sets.filter(set => set.completed).length ?? 0,
      contentInset,
      barInset,
      footerInset,
      restoringInset,
    },
    effects: {
      leave,
      togglePause,
      askFinish,
      askDiscard,
      cancelDiscard,
      discard,
      openSet,
      openExercise,
      toggleSet,
      addSet,
      skip: sessionActions.skipExercise,
      requestRemove: setRemoving,
      confirmRemove,
      cancelRemove,
      addExercise,
      pickRoutine,
      footerLayout,
      dockHeight: setDockHeight,
      skipRest: rest.skip,
      adjustRest: rest.adjust,
      fixRestAlerts,
    },
  };
}
