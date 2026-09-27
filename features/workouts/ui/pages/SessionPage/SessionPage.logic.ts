import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MetaItem } from '@/features/core/design-system';
import { haptics, useHaptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { screenGutter, spacing } from '@/features/core/theme';
import { type TKey, type TVars, useT } from '@/features/core/translations';
import {
  formatAgoLocalized,
  formatDurationCompact,
  formatTimer,
  formatWeight,
  type UnitSystem,
} from '@/features/core/utils';
import { useSettings } from '@/features/settings';
import type { PreviousLift } from '@/features/workouts/domain/entities/PreviousLift';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { sessionActions, useActiveSession } from '@/features/workouts/facades/useActiveSession';
import { useDiscardSession } from '@/features/workouts/facades/useDiscardSession';
import { useFinishSession } from '@/features/workouts/facades/useFinishSession';
import { useKeepScreenAwake } from '@/features/workouts/facades/useKeepScreenAwake';
import { usePreviousPerformance } from '@/features/workouts/facades/usePreviousPerformance';
import { useRestTimer } from '@/features/workouts/facades/useRestTimer';
import { useSessionProgress } from '@/features/workouts/hooks/useSessionProgress';

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
 * is genuinely new (say so), or there is a previous number, and then the heaviest set's load and
 * reps, which is what decides whether to add weight.
 */
function previousFor(
  lift: PreviousLift | undefined,
  isLoading: boolean,
  units: UnitSystem,
  t: Translate,
  locale: string,
): { previousLabel: string | null; previousWhen: string | null } {
  if (lift === undefined) return { previousLabel: isLoading ? null : t('session.noPrevious'), previousWhen: null };
  const heaviest = lift.sets.reduce<(typeof lift.sets)[number] | null>(
    (best, set) => (best === null || set.weightKg > best.weightKg ? set : best),
    null,
  );
  if (heaviest === null) return { previousLabel: t('session.noLoadRecorded'), previousWhen: null };
  const load =
    heaviest.weightKg === 0 ? t('session.bodyweight') : `${formatWeight(heaviest.weightKg, units)} × ${heaviest.reps}`;
  const when =
    Number.isFinite(lift.performedAt) && lift.performedAt > 0 ? formatAgoLocalized(lift.performedAt, t, locale) : null;
  return { previousLabel: t('session.lastTime', { load }), previousWhen: when };
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
  const { session, hydrated, persistFailed, awayNoticeSeconds } = useActiveSession();
  const progress = useSessionProgress(session);
  const rest = useRestTimer(session);
  const finishSession = useFinishSession();
  const discardSession = useDiscardSession();

  const units = useSettings(settings => settings.unitSystem);
  const autoStartRest = useSettings(settings => settings.autoStartRest);
  const keepScreenAwake = useSettings(settings => settings.keepScreenAwake);

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
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
      if (autoStartRest) startRest(startedRest);
    },
    [autoStartRest, retract, startRest],
  );

  const openSet = useCallback((entryIndex: number, setIndex: number) => {
    sessionActions.focus(entryIndex);
    router.push(routes.sessionSet(entryIndex, setIndex));
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

  const { mutate: finishMutate } = finishSession;
  const finish = useCallback(() => {
    if (session === null || finishing) return;
    setFinishing(true);
    retract();
    finishMutate(
      { id: session.id, routineId: session.routineId },
      {
        onSuccess: result => {
          setConfirmFinish(false);
          // NOTE: one signature per finish: a record's sheet plays its own, and two designed
          // patterns a moment apart blur into one long buzz.
          if (result.personalRecords.length === 0) {
            if (result.closedWeeklyGoal) haptics.weeklyGoalReached();
            else haptics.workoutFinished();
          }
          // NOTE: the workout now tops the history on Home, so that is where this goes; a record is
          // then presented over Home as a sheet, worth stopping for.
          router.dismissTo(routes.home());
          if (result.personalRecords.length > 0) router.push(routes.sessionRecords(result.personalRecords));
        },
        onError: error => {
          setFinishing(false);
          if (error._tag === 'DuplicateWorkout' || error._tag === 'NoActiveSession') {
            // NOTE: nothing was written this time: saying otherwise would send someone to a history
            // that does not contain the workout they just did.
            setConfirmFinish(false);
            setActionError(t('session.saveFailed'));
            return;
          }
          setActionError(t('session.saveFailedKept'));
        },
      },
    );
  }, [finishMutate, finishing, retract, session, t]);

  const askFinish = useCallback(() => setConfirmFinish(true), []);
  const cancelFinish = useCallback(() => setConfirmFinish(false), []);
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
  const dockExtent = restShown ? dockHeight + insets.bottom + spacing.md : 0;
  const contentPadding = Math.max(footerHeight, dockExtent) + spacing.xl;
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
      confirmFinish,
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
      showAwayNotice: awayNoticeSeconds > AWAY_NOTICE_SECONDS,
      awayNotice: t('session.awayNotice', { time: formatDurationCompact(awayNoticeSeconds) }),
      exercisesEyebrow: `${entryCount} ${t('session.exerciseWord', { count: entryCount })}`,
      finishMessage:
        progress.ratio < 1
          ? t('session.finishPartial', {
              left: progress.planned - progress.completed,
              planned: progress.planned,
              word: setWord,
            })
          : t('session.finishAll', { planned: progress.planned }),
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
      cancelFinish,
      finish,
      askDiscard,
      cancelDiscard,
      discard,
      openSet,
      toggleSet,
      addSet,
      skip: sessionActions.skipExercise,
      focus: sessionActions.focus,
      requestRemove: setRemoving,
      confirmRemove,
      cancelRemove,
      addExercise,
      pickRoutine,
      footerLayout,
      dockHeight: setDockHeight,
      skipRest: rest.skip,
      adjustRest: rest.adjust,
    },
  };
}
