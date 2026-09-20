/**
 * The live workout: the only screen in the app that holds something unfinished.
 *
 * ## The engine owns the truth; this screen owns the asking
 *
 * Every mutation here is a synchronous call into `@/workout/session`, which writes to
 * SQLite before it publishes. Nothing on this screen has pending state, a spinner, or an
 * undo — the write has already landed by the time the press handler returns. What the
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
 * timer works the same way — it survives by re-deriving from the deadline, not by counting
 * in a component that may no longer exist.
 *
 * ## Why the rest notification lives here
 *
 * The engine is deliberately free of notification imports: it should not care whether the
 * device is allowed to buzz. But a rest timer with no alert is a rest timer you cannot walk
 * away from, so the screen arms one at the exact moment a rest begins — which is *here*, in
 * the one handler that starts a rest — and retracts it when the user starts the next set
 * early. Arming it in the engine would put a `Permissions`-shaped failure inside a module
 * whose job is arithmetic.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import {
  addSet,
  setSessionNotes,
  clearRest,
  discardSession,
  finishSession,
  pauseSession,
  removeExercise,
  removeSet,
  resumeSession,
  setActiveIndex,
  setRestTimer,
  skipExercise,
  toggleSet,
  updateSet,
  useRestRemaining,
  useSessionProgress,
  useWorkoutSession,
} from '@/workout/session';
import { formatRecordValue, RECORD_LABEL } from '@/queries/useExerciseHistory';
import { invalidateAfterWorkout } from '@/query/invalidation';
import {
  usePreviousPerformance,
  type PreviousLift,
} from '@/queries/useRoutines';
import { haptics, useHaptics } from '@/services/haptics';
import {
  cancelScheduledNotification,
  notifyRestComplete,
} from '@/services/notifications';
import { routes } from '@/navigation/nav';
import { useSettings } from '@/settings';
import type { UnitSystem } from '@/utils/format';
import type { Exercise, PersonalRecord } from '@/domain/types';
import {
  compactNumber,
  countNoun,
  formatAgo,
  formatDurationCompact,
  formatTimer,
  formatWeight,
  joinMiddleDot,
  pluralWord,
  weightUnit,
  weightValue,
} from '@/utils/format';
import { useAppTheme } from '@/theme/theme';
import { radius, spacing, z } from '@/theme/tokens';
import { Button, IconButton } from '@/ui/Button';
import { Card, OverlaySurface, Row, SectionHeader } from '@/ui/layout';
import { Chip } from '@/ui/controls';
import { MetricLabel, Txt } from '@/ui/Text';
import { EmptyState, SkeletonCard } from '@/ui/states';
import { Icon } from '@/ui/icons';
import {
  ExerciseBlock,
  RestDock,
  RemoveExerciseSheet,
  SessionProgressBar,
  SetEditorSheet,
} from '@/ui/workout';
import { ConfirmSheet, OptionSheet, Sheet, SheetFooter } from '@/ui/Sheet';
import { ExercisePickerSheet } from '@/ui/exercisePicker';
import { addExerciseToSession } from '@/workout/sessionExercises';
import { TextField } from '@/ui/TextField';

/** Rest presets, in seconds. Offered as chips because typing "90" on a rest break is absurd. */
const REST_PRESETS = [45, 60, 90, 120, 180] as const;

/** Bottom clearance: the footer, plus the dock when a rest is running, plus the home bar. */
const BOTTOM_SPACE = 210;

export default function WorkoutSessionScreen() {
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
  const defaultRest = useSettings((s) => s.defaultRestSeconds);

  const [editor, setEditor] = useState<{ entryIndex: number; setIndex: number } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [restSheet, setRestSheet] = useState(false);
  const [notesSheet, setNotesSheet] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [records, setRecords] = useState<PersonalRecord[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addingExercise, setAddingExercise] = useState(false);

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
   * defeats the `memo` on every `ExerciseBlock` below — the whole list re-rendering on a
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
   * from disk never went through it — so the clamp belongs here too, and the footer's
   * current exercise must not be a `undefined` crash dressed up as an edge case.
   */
  const activeIndex = Math.min(
    session?.activeIndex ?? 0,
    Math.max(0, (session?.entries.length ?? 1) - 1),
  );

  liveRef.current = { session, activeIndex };

  const retract = restRemaining > 0;

  const retractRestAlert = useCallback(() => {
    const id = restAlertId.current;
    restAlertId.current = null;
    if (id !== null) void cancelScheduledNotification(id);
  }, []);

  // Deliberately *not* retracted on unmount. Leaving this screen mid-rest — to answer a
  // message, or to look at a previous session — is the case the alert exists for: the rest
  // is still running, and the user is no longer looking at it. Only these retract it: an
  // un-ticked set, a skipped rest, a re-armed rest, finishing, discarding.

  const armRest = useCallback(
    (seconds: number) => {
      setRestTimer(seconds);
      if (!notificationsOn) return;
      const { session: live, activeIndex: index } = liveRef.current;
      if (live === null) return;
      const name = live.entries[index]?.exerciseName ?? 'This set';
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
    [notificationsOn],
  );

  const onToggleSetAt = useCallback(
    (entryIndex: number, setIndex: number) => {
      const startedRest = toggleSet(entryIndex, setIndex);
      if (startedRest === null) {
        // Un-ticking: pull back the alert the tick armed, or the phone announces a rest
        // that is no longer happening.
        retractRestAlert();
        return;
      }
      if (autoStartRest) armRest(startedRest);
    },
    [armRest, autoStartRest, retractRestAlert],
  );

  const openSet = useCallback((entryIndex: number, setIndex: number) => {
    setActiveIndex(entryIndex);
    setEditor({ entryIndex, setIndex });
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

  /**
   * An exercise chosen from the library, mid-workout.
   *
   * The picker deliberately stays open after a tap — the row turns into a checkmark — so
   * adding two accessories in one go does not mean opening a sheet twice. The sheet closes on
   * Done, which is why nothing here navigates.
   *
   * `void`-and-`catch` rather than an `async` handler: this is a press handler with nothing to
   * await it, and an unhandled rejection on a button is a crash with no explanation.
   */
  const onPickExercise = useCallback(
    (exercise: Exercise) => {
      void addExerciseToSession({
        exercise,
        defaultRestSeconds: defaultRest,
        isDuplicate: (liveRef.current.session?.entries ?? []).some(
          (entry) => entry.exerciseId === exercise.id,
        ),
      })
        .then((added) => {
          if (added) {
            haptics.success();
            return;
          }
          // The two reasons this returns false are indistinguishable from here, and both mean
          // the list did not change: it was already in the workout, or the workout finished
          // while the sheet was open. Either way the honest statement is "nothing changed".
          setActionError(
            'That exercise did not go in — it is either already in this workout, or the workout has ended. Nothing was changed.',
          );
          haptics.warning();
        })
        .catch(() => {
          setActionError(
            'Your phone could not store that exercise, so it was not added. Your workout is unchanged.',
          );
          haptics.warning();
        });
    },
    [defaultRest],
  );

  const isInThisWorkout = useCallback(
    (exerciseId: string) => entryIds.includes(exerciseId),
    [entryIds],
  );

  const patchSet = useCallback(
    (
      entryIndex: number,
      setIndex: number,
      patch: { reps?: number; weightKg?: number; rpe?: number | null },
    ) => {
      updateSet(entryIndex, setIndex, patch);
    },
    [],
  );

  const discard = useCallback(async () => {
    if (session === null || discarding) return;
    setDiscarding(true);
    retractRestAlert();
    // `error()`, not `warning()`: this is the app refusing to lose something quietly. The
    // haptic fires *before* the await, which is where it belongs — a confirmation buzz
    // after a disk write is a buzz nobody connects to the tap that caused it.
    haptics.error();
    try {
      await discardSession(session.id);
      setConfirmDiscard(false);
      router.back();
    } catch {
      setDiscarding(false);
      setActionError('Your phone could not delete the session. The workout is still here.');
    }
  }, [discarding, retractRestAlert, session]);

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
        setActionError('Your phone could not save the session. Try again.');
        setFinishing(false);
        return;
      }
      haptics.success();
      if (result.personalRecords.length > 0) {
        // The sheet, not a toast: a PR is worth stopping for, and it is also the moment
        // someone decides whether the session was worth doing.
        setRecords(result.personalRecords);
      } else {
        router.replace(routes.workoutHistory());
      }
    } catch {
      setActionError('Your phone could not save the session. Nothing was lost — try again.');
      setFinishing(false);
    }
  }, [client, finishing, retractRestAlert, session]);

  if (!hydrated) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl }}>
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
        <EmptyState
          title="No workout in progress"
          message="Start one from a routine and it shows up here, with your last numbers beside every set."
          icon="workout"
          actionLabel="Pick a routine"
          onAction={() => {
            router.replace(routes.workoutTab());
          }}
          style={{ paddingTop: insets.top + spacing.xxxl }}
        />
      </View>
    );
  }

  const running = session.status === 'active';
  const active = session.entries[activeIndex] ?? session.entries[0];
  const doneSets = session.entries.reduce(
    (n, entry) => n + entry.sets.filter((set) => set.completed).length,
    0,
  );
  const volumeKg = session.entries.reduce(
    (n, entry) =>
      n + entry.sets.reduce((m, set) => m + (set.completed ? set.reps * set.weightKg : 0), 0),
    0,
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ gestureEnabled: false }} />

      <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
        <OverlaySurface theme={theme} edge="bottom" />
        <Row gap="sm" align="center">
          <IconButton
            name="close"
            variant="surface"
            size={20}
            accessibilityLabel="Leave the workout. It keeps running."
            accessibilityHint="Returns to the previous screen. The session is not lost."
            onPress={() => {
              router.back();
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="label" weight="700" numberOfLines={1}>
              {session.routineName}
            </Txt>
            {/* The noun agrees with the denominator, not the numerator: "1/18 set" reads
                as though eighteen sets were one set. `1/1 set` is the only singular case,
                which is exactly what `progress.planned` gives. */}
            <Txt variant="micro" tone="muted">
              {`${formatTimer(session.elapsedSeconds)} · ${doneSets}/${progress.planned} ${pluralWord(progress.planned, 'set')}`}
            </Txt>
          </View>
          <Chip
            size="sm"
            label={running ? 'Running' : 'Paused'}
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
            accessibilityLabel="Finish and save this workout"
            onPress={() => {
              setConfirmFinish(true);
            }}
          />
        </Row>
        <View style={{ height: spacing.sm }} />
        <SessionProgressBar ratio={progress.ratio} theme={theme} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: BOTTOM_SPACE + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {persistFailed ? (
          <View style={styles.section}>
            <Card tone="outline" style={{ borderColor: theme.colors.danger }}>
              <Row gap="md" align="center">
                <Icon name="warning" size={20} color={theme.colors.danger} />
                <View style={{ flex: 1 }}>
                  <Txt variant="strong" weight="700">
                    Not saving to this device
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    Your phone refused a write, so these sets exist only until the app
                    closes. Keep going — it will retry with every set — but do not force
                    quit.
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
                Could not save that
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
                  {`Away for ${formatDurationCompact(awayNoticeSeconds)}. The clock only counts while the app is open, and rest resumed from where it was.`}
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
            title="Exercises"
            eyebrow={countNoun(session.entries.length, 'exercise')}
            action={
              <Button
                label="Add"
                size="sm"
                variant="secondary"
                icon="plus"
                onPress={() => {
                  haptics.light();
                  setAddingExercise(true);
                }}
                accessibilityHint="Search the exercise library and add one to this workout"
              />
            }
          />
          {session.entries.length === 0 ? (
            <EmptyState
              title="No exercises in this workout"
              message="The routine this started from had nothing in it. Add one from the library and it is stored on the device straight away."
              icon="dumbbell"
              actionLabel="Add an exercise"
              onAction={() => {
                haptics.light();
                setAddingExercise(true);
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
                  previousLine={previousLineFor(
                    previous.get(entry.exerciseId),
                    previous.isLoading,
                    units,
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

        <View style={styles.section}>
          <SectionHeader title="Session notes" eyebrow="Saved with the workout" />
          <Card onPress={() => setNotesSheet(true)}>
            <Txt
              variant={session.notes === null ? 'body' : 'bodyLg'}
              tone={session.notes === null ? 'faint' : 'default'}
              numberOfLines={3}
            >
              {session.notes ?? 'How did it go? Added to the activity when you finish.'}
            </Txt>
          </Card>
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        {/* Sibling of the buttons, never their parent: a blur that contains them
            re-blurs on every press-state change. */}
        <OverlaySurface theme={theme} />
        <Row gap="md" align="center">
          <Button
            label="Discard"
            variant="ghost"
            size="md"
            onPress={() => {
              setConfirmDiscard(true);
            }}
          />
          <Button
            label="Finish"
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
            // `setRestTimer` floors at 5 seconds — it has no way to say "no rest" — so the
            // dock stepping below that has to clear the timer instead, or minus-15s would
            // appear to stop working five seconds short of zero.
            if (seconds < 5) clearRest();
            else setRestTimer(seconds);
            haptics.selection();
          }}
        />
      ) : null}

      {/* ---- Sheets ---- */}

      {editor ? (
        <EditorFor
          session={session}
          target={editor}
          units={units}
          onChange={patchSet}
          onRemove={(entryIndex, setIndex) => {
            removeSet(entryIndex, setIndex);
            setEditor(null);
            // Only if a set remains to stand in its place; otherwise the sheet closed
            // because there was nothing left to edit.
          }}
          onRequestClose={() => setEditor(null)}
        />
      ) : null}

      {restSheet ? (
        <OptionSheet<number>
          title="Rest timer"
          value={session.restDurationSeconds ?? active?.restSeconds ?? 90}
          options={REST_PRESETS.map((seconds) => ({
            value: seconds,
            label: seconds >= 60 ? `${seconds / 60} min` : `${seconds}s`,
          }))}
          onSelect={(seconds) => {
            setRestSheet(false);
            armRest(seconds);
            haptics.selection();
          }}
          onRequestClose={() => setRestSheet(false)}
        />
      ) : null}

      {notesSheet ? (
        <NotesSheet
          initial={session.notes ?? ''}
          onSave={(notes) => {
            setSessionNotesSafely(notes);
            setNotesSheet(false);
          }}
          onRequestClose={() => setNotesSheet(false)}
        />
      ) : null}

      {confirmDiscard ? (
        <ConfirmSheet
          title="Discard this workout?"
          message={`${doneSets} ${pluralWord(doneSets, 'set')} ${doneSets === 1 ? 'goes' : 'go'} unrecorded, and this workout will not appear in your history or your totals. There is no undo.`}
          confirmLabel={discarding ? 'Discarding…' : 'Discard workout'}
          onConfirm={() => {
            void discard();
          }}
          onRequestClose={() => setConfirmDiscard(false)}
        />
      ) : null}

      {confirmFinish ? (
        <ConfirmSheet
          title="Finish this workout?"
          message={
            progress.ratio < 1
              ? `${progress.planned - progress.completed} of ${progress.planned} ${pluralWord(progress.planned, 'set')} left un-ticked. Un-ticked work is not recorded — the workout saves what you completed.`
              : `All ${progress.planned} sets are done. This becomes an activity in your history.`
          }
          confirmLabel={finishing ? 'Saving…' : 'Finish and save'}
          onConfirm={() => {
            void finish();
          }}
          onRequestClose={() => setConfirmFinish(false)}
        />
      ) : null}

      {removing !== null ? (
        <RemoveExerciseSheet
          exerciseName={session.entries[removing]?.exerciseName ?? 'This exercise'}
          completedSets={session.entries[removing]?.sets.filter((set) => set.completed).length ?? 0}
          onConfirm={() => {
            removeExercise(removing);
            setRemoving(null);
            haptics.medium();
          }}
          onRequestClose={() => setRemoving(null)}
        />
      ) : null}

      {addingExercise ? (
        /*
          A sheet over the session rather than a pushed screen, which is what the `picker`
          route in this group was for. `ExercisePickerSheet` already hands the chosen exercise
          back through a callback; routing there instead would mean parking the choice in a
          store and reading it out on unmount — a shared mutable mailbox, on the one screen in
          the app that must not lose state. The sheet also keeps the workout visible behind the
          scrim, so the set you were on is still on screen while you pick.
        */
        <ExercisePickerSheet
          isIncluded={isInThisWorkout}
          onPick={onPickExercise}
          onClose={() => setAddingExercise(false)}
        />
      ) : null}

      {records !== null ? (
        <RecordsSheet
          records={records}
          units={units}
          onDone={() => {
            setRecords(null);
            router.replace(routes.workoutHistory());
          }}
        />
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- fragments -- */

/**
 * The sheet for one set, resolved from the live session on every render.
 *
 * Not a `useState` holding a `StrengthSet`: the engine writes through on every stepper
 * press, and a snapshot in state would freeze the sheet at the moment it opened while the
 * row behind it moved. Reading by index is free and always agrees with the screen.
 */
function EditorFor({
  session,
  target,
  units,
  onChange,
  onRemove,
  onRequestClose,
}: {
  session: NonNullable<ReturnType<typeof useWorkoutSession>['session']>;
  target: { entryIndex: number; setIndex: number };
  units: UnitSystem;
  onChange: (
    entryIndex: number,
    setIndex: number,
    patch: { reps?: number; weightKg?: number; rpe?: number | null },
  ) => void;
  onRemove: (entryIndex: number, setIndex: number) => void;
  onRequestClose: () => void;
}) {
  const entry = session.entries[target.entryIndex];
  const set = entry?.sets[target.setIndex];
  if (!entry || !set) return null;
  return (
    <SetEditorSheet
      entry={entry}
      set={set}
      units={units}
      onChange={(patch) => {
        onChange(target.entryIndex, target.setIndex, patch);
      }}
      onRemove={() => {
        onRemove(target.entryIndex, target.setIndex);
      }}
      onRequestClose={onRequestClose}
    />
  );
}

/**
 * Session notes.
 *
 * A sheet with a text field, because notes are the one place in a workout that is prose.
 * It opens *from* a card rather than showing a field inline so the keyboard can never be
 * sitting over the set list when someone scrolls past.
 */
function NotesSheet({
  initial,
  onSave,
  onRequestClose,
}: {
  initial: string;
  onSave: (notes: string) => void;
  onRequestClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <Sheet onRequestClose={onRequestClose} title="Session notes">
      {/* The sentence here is a hint about where the text goes, not a section heading, so
          it rides on the field: as a `SheetSection` title it stacked a second caption
          above the field's own "Notes" label. `SheetFooter` supplies the divider. */}
      <TextField
        label="Notes"
        value={draft}
        onChangeText={setDraft}
        multiline
        autoFocus
        placeholder="Bar speed, sleep, that nagging shoulder."
        hint="Stored on this device, with the activity."
      />
      <SheetFooter>
        <Button label="Cancel" variant="quiet" onPress={onRequestClose} />
        <Button label="Save" variant="primary" fullWidth onPress={() => onSave(draft)} />
      </SheetFooter>
    </Sheet>
  );
}

/**
 * What you just did better than you have ever done it.
 *
 * Not dismissible by backdrop, because the only correct action is to acknowledge it and
 * then land somewhere sensible. `onDone` is the sole exit and it goes to history — back
 * would return to a session screen that no longer has a session.
 */
function RecordsSheet({
  records,
  units,
  onDone,
}: {
  records: readonly PersonalRecord[];
  units: UnitSystem;
  onDone: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Sheet
      title={records.length === 1 ? 'Personal record' : `${records.length} personal records`}
      dismissible={false}
      onRequestClose={onDone}
    >
      <View style={{ gap: spacing.sm }}>
        {records.map((record) => (
          <View
            key={`${record.exerciseId}-${record.kind}`}
            style={[
              styles.record,
              { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.border },
            ]}
          >
            <Row gap="md" align="center">
              <Icon name="trophy" size={20} color={theme.colors.accent} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="strong" weight="700" numberOfLines={1}>
                  {record.exerciseName}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {RECORD_LABEL[record.kind]}
                </Txt>
              </View>
              <Txt variant="numeralSm" weight="700" tone="accent">
                {formatRecordValue(record.kind, record.value, units)}
              </Txt>
            </Row>
          </View>
        ))}
      </View>
      <SheetFooter>
        <Button label="See it in history" variant="primary" fullWidth onPress={onDone} />
      </SheetFooter>
    </Sheet>
  );
}

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
  const items = [
    { label: 'Elapsed', value: formatDurationCompact(elapsed) },
    { label: 'Sets', value: `${sets}/${planned}` },
    {
      label: `Volume (${weightUnit(units)})`,
      value: compactNumber(weightValue(volumeKg, units)),
    },
  ];
  return (
    <Row gap="xl" align="start" wrap>
      {items.map((item) => (
        <View key={item.label} style={{ minWidth: 84 }}>
          <MetricLabel label={item.label} />
          <Txt
            variant="numeralSm"
            weight="700"
            style={{ fontVariant: ['tabular-nums'], marginTop: spacing.xxs }}
          >
            {item.value}
          </Txt>
        </View>
      ))}
    </Row>
  );
}

/* ------------------------------------------------------------------ helpers -- */

/**
 * The first set in this block that is still outstanding.
 *
 * "First unticked" rather than "one past the last ticked", because dropping a middle set
 * and finishing the rest is normal — a bench press where the third set became a phone call
 * should still point at the third set.
 */
function firstOpenSetIndex(entry: {
  sets: { completed: boolean }[];
}): number | null {
  const index = entry.sets.findIndex((set) => !set.completed);
  return index < 0 ? null : index;
}

/**
 * "Last time 82.5 kg × 5 · 3 weeks ago", or the honest alternative.
 *
 * Three distinct answers, because there are three distinct truths: the history query has
 * not answered yet (say nothing — "no previous data" before it has is a lie), it answered
 * and this exercise is genuinely new (say so, since "nothing here yet" is useful), or there
 * is a previous number (say it). The last case is the one that decides whether to add
 * weight, which is why it gets the most detail: heaviest set's load and reps, not a volume
 * figure nobody can act on between sets.
 */
function previousLineFor(
  lift: PreviousLift | undefined,
  isLoading: boolean,
  units: UnitSystem,
): string | null {
  if (lift === undefined) return isLoading ? null : 'No previous sessions of this exercise';
  const heaviest = lift.sets.reduce<(typeof lift.sets)[number] | null>(
    (best, set) => (best === null || set.weightKg > best.weightKg ? set : best),
    null,
  );
  if (heaviest === null) return 'Last time, no load recorded';
  const load =
    heaviest.weightKg === 0
      ? 'bodyweight'
      : `${formatWeight(heaviest.weightKg, units)} × ${heaviest.reps}`;
  // `joinMiddleDot` rather than a template literal: the "when" half is omitted for a row
  // whose timestamp is unusable, and a hand-joined string would leave a dangling dot.
  return joinMiddleDot([`Last time ${load}`, formatAgo(lift.performedAt)]);
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
  if (open.length > 1) return `${open.length - 1} more ${pluralWord(open.length - 1, 'set')} of ${entry.exerciseName}`;
  const nextEntry = session.entries.slice(activeIndex + 1).find((e) => e.sets.length > 0);
  return nextEntry?.exerciseName ?? '';
}

/**
 * Notes, guarded.
 *
 * `setSessionNotes` is fire-and-forget inside the engine and swallows its own write
 * failure into `persistFailed`, which the banner on this screen already reports. Calling it
 * raw is correct; the comment is here because "no try/catch around an async-looking call"
 * looks like an oversight and is not one.
 */
function setSessionNotesSafely(notes: string): void {
  setSessionNotes(notes.trim().length > 0 ? notes.trim() : null);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    // No border here: `OverlaySurface` draws the hairline, and a second one on the
    // same edge reads as a thicker, fuzzier line.
    zIndex: z.sticky,
  },
  content: { flexGrow: 1, paddingTop: spacing.lg },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  // No `zIndex`: the rest dock is rendered after this and is also `z.sticky`, and the
  // dock must stay on top of the footer. Leaving this at `auto` keeps that ordering
  // unambiguous rather than a tie won by DOM order.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  record: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
} satisfies Record<string, ViewStyle>);
