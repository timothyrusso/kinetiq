/**
 * A saved routine: the plan, and the controls around it.
 *
 * Reached from the Workout tab, the routines list, the workout picker and: via `replace`, * from the builder that just created it. `routine/_layout.tsx` registers this one as a card
 * rather than a modal so the browse → open → train → back loop keeps the stack underneath it.
 *
 * ## Every edit writes on change, and there is no Done button
 *
 * The builder saves once, at the end, because a half-built routine is not worth keeping. This
 * screen is the opposite case: the routine already exists on disk, so a row the user changed
 * and then navigated away from must be changed. "Save" on a screen whose every control has
 * already taken effect would be a button that lies about what it does. So the steppers write
 * straight through `useSetRoutineItem`, and the only confirmation on this screen stands in
 * front of deleting something.
 *
 * ## What "offline" means here
 *
 * Everything on this screen comes from SQLite. The exercises were frozen into the local
 * `exercises` table when they were added (`useAddRoutineExercise` → `snapshotOf`), so with no
 * network this screen renders the same: names, thumbnails, muscle groups, instructions. It
 * makes no request to the exercise API, ever, and there is no pull-to-refresh, because there
 * is nothing remote to refresh. Opening a routine on a plane is not a degraded mode; it is the
 * normal mode. The one place a network is needed is adding a *new* exercise, and the picker
 * sheet says so in its own error state.
 *
 * ## Previous performance lives on the session screen, not here
 *
 * It would be reasonable to print "last time: 3 × 95 kg" beside each row, and it deliberately
 * is not here. That number is already rendered where it is used: while the set is being
 * entered, in `app/workout/session.tsx`: and computing it means scanning the last 24 workouts.
 * A plan screen that reads 24 activities to decorate itself gets slower as history grows, for a
 * number the user is not deciding anything with yet. `timesCompleted` and `lastPerformedAt` are
 * columns on the routine this screen already loads, so it still says when the routine was last
 * trained, in one indexed read.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes } from '@/navigation/nav';
import { BarAction, DetailScreen } from '@/ui/Screen';
import { Button } from '@/ui/Button';
import { Card, Row, SectionHeader, Stack as Column } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { EmptyState, ErrorState, SkeletonList } from '@/ui/states';
import { ConfirmSheet, Sheet, SheetFooter } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { NavRow } from '@/ui/rows';
import { ExercisePickerSheet } from '@/ui/exercisePicker';
import { ItemEditorSheet, RoutineItemRow, type ItemPosition } from '@/ui/routineItems';
import {
  useAddRoutineExercise,
  useDeleteRoutine,
  useDuplicateRoutine,
  useRemoveRoutineItem,
  useRenameRoutine,
  useReorderRoutine,
  useRoutine,
  useSetRoutineItem,
} from '@/queries/useRoutines';
import { useSettings } from '@/settings';
import { useStartRoutine } from '@/workout/startRoutine';
import { useWorkoutSession } from '@/workout/session';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { haptics } from '@/services/haptics';
import { moveItem } from '@/utils/functional';
import { defaultItemTarget, orderedIdsOf, pairItems, type ItemTarget } from '@/routines/draft';
import { estimateMinutes, plannedVolumeKg } from '@/domain/logic';
import {
  countNoun,
  formatAgo,
  joinMiddleDot,
  pluralWord,
  trimNumber,
  weightUnit,
  weightValue,
} from '@/utils/format';
import type { Exercise } from '@/domain/types';

type SheetKind = 'actions' | 'rename' | 'delete' | 'add' | 'editor' | null;

export default function RoutineDetailScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;

  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { routine, snapshots, missing, isLoading, error, refresh } = useRoutine(id);
  const { session } = useWorkoutSession();

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const setItem = useSetRoutineItem();
  const reorder = useReorderRoutine();
  const removeItem = useRemoveRoutineItem();
  const addExercise = useAddRoutineExercise();
  const rename = useRenameRoutine();
  const duplicate = useDuplicateRoutine();
  const destroy = useDeleteRoutine();
  const { start, busy: starting } = useStartRoutine();

  const items = routine?.items ?? [];
  const rows = useMemo(() => pairItems(items, snapshots), [items, snapshots]);
  // A stable identity for "which exercises are in here", so the picker's `isIncluded` does not
  // change on every render and re-run the hook's memo.
  const exerciseIds = useMemo(() => items.map((item) => item.exerciseId), [items]);
  const isIncluded = useCallback(
    (exerciseId: string) => exerciseIds.includes(exerciseId),
    [exerciseIds],
  );

  const volumeKg = plannedVolumeKg(items);
  const minutes = estimateMinutes(items);
  const editorItem =
    editorItemId === null ? null : (items.find((item) => item.id === editorItemId) ?? null);

  /**
   * A workout is already running.
   *
   * Any session, not only one started from this routine. Two live sessions would mean two rest
   * timers and two elapsed clocks, and the store holds one at a time, so starting a second
   * would silently replace the first: destroying a workout the user is mid-way through. The
   * honest answer is to send them to the session that exists.
   */
  const liveSession =
    session !== null && (session.status === 'active' || session.status === 'paused');

  const begin = useCallback(() => {
    if (routine === null) return;
    start({
      routineId: routine.id,
      routineName: routine.name,
      items: routine.items,
      defaultRestSeconds: defaultRest,
      onResult: (started) => {
        if (started) {
          haptics.success();
          router.push(routes.workoutSession());
          return;
        }
        setFailed('This routine has no exercises yet. Add one before starting it.');
        haptics.warning();
      },
    });
  }, [defaultRest, routine, start]);

  const move = useCallback(
    (from: number, to: number) => {
      if (routine === null) return;
      // The whole list rather than a from/to pair: see `useReorderRoutine`. The ids come from
      // the rows on screen, which is what the user was looking at when they tapped.
      void reorder
        .mutateAsync({ id: routine.id, orderedItemIds: orderedIdsOf(moveItem(items, from, to)) })
        .catch(() => {
          setFailed('That reorder did not stick. Try it again.');
          haptics.warning();
        });
      haptics.selection();
    },
    [items, reorder, routine],
  );

  const changeItem = useCallback(
    (itemId: string, patch: Partial<ItemTarget>) => {
      if (routine === null) return;
      // Fire-and-forget, deliberately. `ItemEditorSheet`'s steppers fire on every tap, so
      // tracking a pending state here would put a spinner behind each press and make the sheet
      // feel broken; the write is a one-row indexed update in a device-local database. A failure
      // is still surfaced: it just is not allowed to interrupt the interaction.
      void setItem.mutateAsync({ routineId: routine.id, itemId, patch }).catch(() => {
        setFailed('That change did not save. Try it again.');
        haptics.warning();
      });
    },
    [routine, setItem],
  );

  const dropItem = useCallback(
    (itemId: string) => {
      if (routine === null) return;
      setSheet(null);
      haptics.light();
      void removeItem.mutateAsync({ routineId: routine.id, itemId }).catch(() => {
        setFailed('That exercise is still in the routine. Try removing it again.');
        haptics.warning();
      });
    },
    [removeItem, routine],
  );

  const doAdd = useCallback(
    (exercise: Exercise) => {
      if (routine === null) return;
      // The opening targets come from `defaultItemTarget`: the same function the draft store
      // calls: so a row added here and a row added in the builder cannot start out different.
      void addExercise
        .mutateAsync({
          routineId: routine.id,
          exercise,
          item: defaultItemTarget(defaultRest),
        })
        .catch(() => {
          setFailed('That exercise could not be added. Nothing was removed.');
          haptics.warning();
          return;
        });
      haptics.success();
    },
    [addExercise, defaultRest, routine],
  );

  const doDuplicate = useCallback(() => {
    if (routine === null) return;
    void duplicate
      .mutateAsync({ id: routine.id, name: `${routine.name} copy` })
      .then((copy) => {
        setSheet(null);
        haptics.success();
        // `replace`, not `push`: you are looking at the copy now. Pushing would leave the
        // original underneath, so a back gesture lands on a screen whose Duplicate button would
        // then make a third routine.
        router.replace(routes.routine(copy.id));
      })
      .catch(() => {
        setFailed('Could not duplicate. The routine is untouched.');
        haptics.warning();
      });
  }, [duplicate, routine]);

  const doDelete = useCallback(() => {
    if (routine === null) return;
    void destroy
      .mutateAsync(routine.id)
      .then(() => {
        setSheet(null);
        haptics.medium();
        // Back where they came from, except when this screen *is* the entry point: a deep link
        // from a notification has nothing to return to, and a back button that does nothing is
        // worse than landing on the tab that lists routines.
        if (router.canGoBack()) router.back();
        else router.replace(routes.workoutTab());
      })
      .catch(() => {
        setFailed('Could not delete it. Nothing was removed.');
        haptics.warning();
      });
  }, [destroy, routine]);

  /* ------------------------------------------------------------ early states */

  if (isLoading) {
    return (
      <DetailScreen title="Routine">
        {() => (
          <View
            style={{ flex: 1, paddingHorizontal: screenGutter, paddingTop: spacing.md }}
          >
            <SkeletonList rows={6} />
          </View>
        )}
      </DetailScreen>
    );
  }

  if (error !== null) {
    return (
      <DetailScreen title="Routine">
        {() => (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: screenGutter }}>
            <ErrorState
              error={error}
              onRetry={() => void refresh()}
              title="This routine could not be read"
            />
          </View>
        )}
      </DetailScreen>
    );
  }

  if (routine === null || missing) {
    // Distinct from loading, and distinct from an error: the read succeeded and there is
    // nothing there. That happens when the row was deleted elsewhere while this screen was
    // open, and it needs a way out rather than a spinner that never ends.
    return (
      <DetailScreen title="Routine">
        {() => (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: screenGutter }}>
            <EmptyState
              icon="listAdd"
              title="This routine is gone"
              message="It was deleted, most likely from another screen in this app."
              actionLabel="Back to workouts"
              onAction={() => router.replace(routes.workoutTab())}
            />
          </View>
        )}
      </DetailScreen>
    );
  }

  return (
    <>
      <DetailScreen
        title={routine.name}
        subtitle={joinMiddleDot([
          `${items.length} ${pluralWord(items.length, 'exercise')}`,
          volumeKg === 0 ? 'Bodyweight' : formatPlanned(volumeKg, units),
          `~${minutes} min`,
        ])}
        right={
          <>
            <BarAction
              icon="more"
              label="Routine options"
              onPress={() => {
                haptics.light();
                setSheet('actions');
              }}
            />
            <BarAction
              icon="play"
              label="Start this workout"
              onPress={() => {
                if (liveSession) {
                  reportLiveSession(session?.routineName, setFailed);
                  return;
                }
                begin();
              }}
            />
          </>
        }
      >
        {(topInset, header) => (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            onScroll={header.onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingTop: topInset + spacing.xl,
              paddingBottom: insets.bottom + spacing.huge,
              gap: spacing.xxl,
            }}
          >
            <Column gap="lg" style={{ paddingHorizontal: screenGutter }}>
              {routine.description === null || routine.description.length === 0 ? null : (
                <Txt variant="body" tone="secondary">
                  {routine.description}
                </Txt>
              )}

              <Row gap="xxl" wrap>
                <Stat label="Planned volume" value={formatPlanned(volumeKg, units)} />
                <Stat label="Est. time" value={`~${minutes} min`} />
                <Stat label="Trained" value={`${routine.timesCompleted}×`} />
                {routine.lastPerformedAt === null ? null : (
                  <Stat label="Last" value={formatAgo(routine.lastPerformedAt)} />
                )}
              </Row>

              {failed !== null ? (
                <Card tone="sunken" padding="md">
                  <Row gap="sm" align="start">
                    <Icon name="warning" size={17} color={theme.colors.warning} />
                    <Txt variant="body" style={{ flex: 1 }}>
                      {failed}
                    </Txt>
                  </Row>
                </Card>
              ) : null}
            </Column>

            {rows.length === 0 ? (
              <EmptyState
                icon="listAdd"
                title="No exercises in this routine"
                message="Nothing here to train yet. Add one from the library and it is stored on the device straight away."
                actionLabel="Add exercise"
                onAction={() => {
                  haptics.light();
                  setSheet('add');
                }}
              />
            ) : (
              <Column gap="md">
                <SectionHeader
                  title="Exercises"
                  eyebrow={`${rows.length} ${pluralWord(rows.length, 'row')}`}
                  action={
                    <Button
                      label="Add"
                      variant="quiet"
                      size="sm"
                      icon="plus"
                      onPress={() => {
                        haptics.light();
                        setSheet('add');
                      }}
                      accessibilityHint="Search the exercise library"
                    />
                  }
                />
                {/* No Card: `ListRow` carries its own horizontal padding and hairline, so a
                    bordered box around it would inset the dividers short of the edges. */}
                <View>
                  {rows.map((row, index) => {
                    const open = () => {
                      setEditorItemId(row.item.id);
                      setSheet('editor');
                    };
                    const position: ItemPosition = {
                      index,
                      count: rows.length,
                      onMove: (to) => move(index, to),
                    };
                    return (
                      <RoutineItemRow
                        key={row.item.id}
                        item={row.item}
                        snapshot={row.snapshot}
                        units={units}
                        position={position}
                        onPress={open}
                        onLongPress={open}
                        onRemove={() => dropItem(row.item.id)}
                      />
                    );
                  })}
                </View>
                <Txt variant="caption" tone="faint" style={{ paddingHorizontal: screenGutter }}>
                  Tap a row to change its sets, reps, weight or rest: changes save as you make
                  them. The arrows reorder the routine.
                </Txt>
              </Column>
            )}

            <Column gap="md" style={{ paddingHorizontal: screenGutter }}>
              <Button
                label={liveSession ? 'Open your workout' : 'Start this workout'}
                icon={liveSession ? 'arrowUpRight' : 'play'}
                size="lg"
                weighty
                fullWidth
                loading={starting}
                onPress={() => {
                  if (liveSession) {
                    router.push(routes.workoutSession());
                    return;
                  }
                  begin();
                }}
                accessibilityHint={
                  liveSession
                    ? 'Opens the workout that is already running'
                    : 'Begins this workout and opens the session'
                }
              />
              {/* The count and the date are on the same line rather than stacked: two faint
                  centred captions under a primary button reads as two warnings. */}
              {routine.timesCompleted > 0 ? (
                <Txt variant="micro" tone="faint" style={{ textAlign: 'center' }}>
                  Completed {routine.timesCompleted}{' '}
                  {countNoun(routine.timesCompleted, 'time')}
                  {routine.lastPerformedAt === null
                    ? ''
                    : ` · most recently ${formatAgo(routine.lastPerformedAt)}`}
                </Txt>
              ) : null}
            </Column>
          </ScrollView>
        )}
      </DetailScreen>

      {sheet === 'actions' ? (
        <Sheet title={routine.name} subtitle="Routine options" onRequestClose={() => setSheet(null)}>
          <ActionRow
            topDivider={false}
            icon="edit"
            title="Rename"
            subtitle="The name also titles future rows in your history"
            theme={theme}
            onPress={() => setSheet('rename')}
          />
          <ActionRow
            icon="copy"
            title="Duplicate"
            subtitle="A copy you can change, including its saved exercise data"
            theme={theme}
            onPress={doDuplicate}
          />
          <ActionRow
            icon="trash"
            title="Delete routine"
            subtitle="Your completed workouts and progress are not affected"
            theme={theme}
            danger
            onPress={() => setSheet('delete')}
          />
        </Sheet>
      ) : null}

      {sheet === 'rename' ? (
        <RenameSheet
          initialName={routine.name}
          busy={rename.isPending}
          onRequestClose={() => setSheet(null)}
          onSubmit={(name) => {
            void rename
              .mutateAsync({ id: routine.id, name })
              .then(() => {
                setSheet(null);
                haptics.success();
              })
              .catch(() => {
                setSheet(null);
                setFailed('The name did not change. Try again.');
                haptics.warning();
              });
          }}
        />
      ) : null}

      {sheet === 'delete' ? (
        <ConfirmSheet
          title={`Delete “${routine.name}”?`}
          message={
            routine.timesCompleted > 0
              ? `You have completed it ${routine.timesCompleted} ${pluralWord(routine.timesCompleted, 'time')}. Those workouts stay in your history and your progress: only the plan is removed.`
              : 'This routine has never been completed, and nothing else will reference it once it is gone.'
          }
          confirmLabel="Delete routine"
          onRequestClose={() => setSheet(null)}
          onConfirm={doDelete}
        />
      ) : null}

      {sheet === 'add' ? (
        <ExercisePickerSheet
          isIncluded={isIncluded}
          onPick={doAdd}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'editor' && editorItem !== null ? (
        <ItemEditorSheet
          item={editorItem}
          snapshot={snapshots.get(editorItem.exerciseId) ?? null}
          units={units}
          defaultRestSeconds={defaultRest}
          onChange={(patch) => changeItem(editorItem.id, patch)}
          onRemove={() => dropItem(editorItem.id)}
          onRequestClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Column gap="xxs">
      <Txt variant="micro" tone="faint" uppercase tracking={0.6}>
        {label}
      </Txt>
      <Txt variant="strong">{value}</Txt>
    </Column>
  );
}

/**
 * One line in the "more" sheet.
 *
 * `NavRow` with its chevron suppressed: these are actions, not destinations, and a chevron
 * promises a screen that is not there. `ListRow` would be wrong in the other direction: it
 * would put the row's own horizontal padding inside a sheet that already has padding, and the
 * three rows would sit narrower than the sheet's title.
 */
function ActionRow({
  icon,
  title,
  subtitle,
  theme,
  danger = false,
  topDivider = true,
  onPress,
}: {
  icon: 'edit' | 'copy' | 'trash';
  title: string;
  subtitle: string;
  theme: Parameters<typeof NavRow>[0]['theme'];
  danger?: boolean;
  topDivider?: boolean;
  onPress: () => void;
}) {
  return (
    <NavRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      theme={theme}
      danger={danger}
      showChevron={false}
      topDivider={topDivider}
      onPress={onPress}
    />
  );
}

/**
 * Rename, as a sheet with a form.
 *
 * Not `OptionSheet`, which closes itself the instant an option is chosen: right for picking a
 * unit, useless for typing one: and not a pushed screen, because the name is one field and a
 * route for one field is a lot of navigation for very little.
 *
 * Local `name` state rather than a write to the repository per keystroke: a routine's name
 * appears in the routines list, the workout picker, the tab's "last trained" card and every
 * history row, so renaming on each character would invalidate all of those queries about twenty
 * times while someone types "Thursday". One commit, on Done.
 *
 * No `KeyboardAvoid`: the sheet is an absolute-fill overlay, and `Sheet` lifts that whole
 * overlay clear of the keyboard itself (see `AvoidingKeyboard`). Wrapping it in a second
 * avoider would compensate for a keyboard that has already been compensated for, and the
 * panel would sit twice the keyboard height above where the content actually is.
 */
function RenameSheet({
  initialName,
  busy,
  onSubmit,
  onRequestClose,
}: {
  initialName: string;
  busy: boolean;
  onSubmit: (name: string) => void;
  onRequestClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const commit = () => {
    if (trimmed.length === 0) {
      // An inline error, not a disabled button: the field is empty, which is the reason, and
      // saying so where the typing happened is faster to act on than a greyed-out control.
      setError('A routine needs a name.');
      haptics.warning();
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <Sheet
      title="Rename routine"
      // Says what else the name does, because it is the one consequence on this screen that is
      // not visible from the field itself.
      subtitle="Future workouts keep this name in your history"
      onRequestClose={onRequestClose}
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={(next) => {
          setName(next);
          if (error !== null) setError(null);
        }}
        error={error}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={commit}
        accessibilityHint="The name of this routine"
      />
      <SheetFooter>
        <Button label="Cancel" variant="ghost" onPress={onRequestClose} />
        <Button label="Save name" weighty loading={busy} style={{ flex: 1 }} onPress={commit} />
      </SheetFooter>
    </Sheet>
  );
}

/* ----------------------------------------------------------------- helpers -- */

/** Planned volume, in the unit the user reads: or the words that replace the number. */
function formatPlanned(volumeKg: number, units: 'metric' | 'imperial'): string {
  if (volumeKg === 0) return 'Bodyweight';
  return `${trimNumber(weightValue(volumeKg, units), 0)} ${weightUnit(units)}`;
}

/**
 * The message for "you already have a workout running".
 *
 * Names the routine that is live when the store can say it. "A workout is in progress" is true
 * and useless; the user's next question is *which one*, and the answer is already in the store.
 */
function reportLiveSession(
  routineName: string | undefined,
  setFailed: (message: string) => void,
): void {
  setFailed(
    routineName
      ? `“${routineName}” is already in progress. Finish or discard it before starting another.`
      : 'A workout is already in progress. Finish or discard it before starting another.',
  );
  haptics.warning();
}
