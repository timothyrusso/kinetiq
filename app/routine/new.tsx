/**
 * Building a new routine.
 *
 * A modal, because it has no history underneath it and it ends by `replace`ing itself with
 * the routine it created.
 *
 * ## The one save, and why not several
 *
 * The name and notes are ordinary controlled inputs; nothing is written until Done. The
 * alternative: autosaving the name on blur the way the saved-routine screen autosaves a
 * stepper press: would create a routine row the moment someone typed three characters and
 * then backed out. `routineRepository.save` has no "empty draft" concept and should not
 * acquire one: a routine with no exercises is not a thing this app displays, and inventing a
 * hidden state for it would leak into the routines list, the counts and the workout picker.
 *
 * The cost of one save is that a crash mid-build loses the build. That is accepted knowingly
 * (see `draftStore` for why even process death is treated as a cancel here), and it is the
 * reason the discard prompt exists rather than a resume-draft feature.
 *
 * ## Adding exercises is a sheet over this screen, not a navigation
 *
 * Pushing the library and coming back would lose the draft's context, and pushing
 * `app/exercise/add` would put a routine *picker* in front of someone who has already told
 * this screen which routine they are building. A sheet writes into the same store the screen
 * is rendering, so a new row is on screen the instant the sheet closes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailScreen } from '@/ui/Screen';
import { Button } from '@/ui/Button';
import { KeyboardAvoid, TextField } from '@/ui/TextField';
import { Card, Row, SectionHeader, Stack as Column } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { EmptyState } from '@/ui/states';
import { ConfirmSheet } from '@/ui/Sheet';
import { ExercisePickerSheet } from '@/ui/exercisePicker';
import { ItemEditorSheet, RoutineItemRow } from '@/ui/routineItems';
import { estimateMinutes, plannedVolumeKg } from '@/domain/logic';
import { useSaveRoutine } from '@/queries/useRoutines';
import { useSettings } from '@/settings';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing, screenGutter } from '@/theme/tokens';
import { trimNumber, weightUnit, weightValue } from '@/utils/format';
import { haptics } from '@/services/haptics';
import { pairItems } from '@/routines/draft';
import {
  addDraftExercise,
  clearDraft,
  containsExercise,
  draftToPayload,
  isDraftDirty,
  isDraftSavable,
  markDraftSaveFailed,
  markDraftSaved,
  markDraftSaving,
  moveDraftItem,
  openDraft,
  removeDraftItem,
  setDraftDescription,
  setDraftName,
  setDraftRestDefault,
  updateDraftItem,
  useRoutineDraft,
} from '@/routines/draftStore';

export default function NewRoutineScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const draft = useRoutineDraft();
  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const saveRoutine = useSaveRoutine();
  const navigation = useNavigation();

  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  // Opened during the first render rather than in an effect, on purpose: `openDraft` always
  // resets, and doing it after the first paint would show whatever the last abandoned build
  // left behind for one frame before wiping it.
  useState(() => {
    openDraft({ defaultRestSeconds: defaultRest });
    return null;
  });

  // Keep the store's rest default in step with Settings, so a row added after the user
  // changed their default gets the new one and not the one read at mount. The store bails on
  // an equal value, so this cannot loop.
  useEffect(() => {
    setDraftRestDefault(defaultRest);
  }, [defaultRest]);

  const snapshotByExerciseId = useMemo(
    () => new Map(draft.snapshots.map((row) => [row.exerciseId, row])),
    [draft.snapshots],
  );
  const rows = useMemo(
    () => pairItems(draft.items, snapshotByExerciseId),
    [draft.items, snapshotByExerciseId],
  );

  const editorItem =
    editorItemId === null ? null : (draft.items.find((item) => item.id === editorItemId) ?? null);

  const volumeKg = plannedVolumeKg(draft.items);
  const minutes = estimateMinutes(draft.items);

  const save = useCallback(async () => {
    if (!isDraftSavable()) {
      // An inline reason, not a permanently greyed-out primary button: a call-to-action that
      // cannot be pressed and says nothing about why is the most reliably confusing control
      // in a form.
      setBlocked('Add at least one exercise before saving.');
      haptics.warning();
      return;
    }
    setBlocked(null);
    markDraftSaving();
    try {
      const saved = await saveRoutine.mutateAsync(draftToPayload());
      markDraftSaved();
      haptics.success();
      // `replace`, not `push`: this screen has now become the routine it describes. Leaving
      // the builder underneath it means "back" returns to a form whose entire contents have
      // been saved, which the user would then be invited to save again.
      router.replace(routes.routine(saved.id));
    } catch {
      markDraftSaveFailed();
      setBlocked('Could not save. Nothing was lost: the routine is still here as you left it.');
      haptics.warning();
    }
  }, [saveRoutine]);

  // Back gesture, hardware back, the swipe and the back button all route through
  // `beforeRemove`, which is the only hook that fires for all four. Without it, the same
  // thumb that can lose a workout by backgrounding the app can lose a routine by swiping.
  //
  // The latch is a ref, not state: registering a listener per state change would resubscribe
  // on every keystroke, and the handler needs the current answer either way.
  const discardConfirmed = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (discardConfirmed.current || !isDraftDirty()) return;
        event.preventDefault();
        setConfirmDiscard(true);
      }),
    [navigation],
  );

  return (
    <>
      <DetailScreen
        title="New routine"
        subtitle={
          draft.items.length === 0
            ? 'Add exercises from the library'
            : `${draft.items.length} ${draft.items.length === 1 ? 'exercise' : 'exercises'} · about ${minutes} min`
        }
        right={
          <Button
            label={draft.status === 'saving' ? 'Saving…' : 'Done'}
            variant="ghost"
            size="sm"
            disabled={draft.status === 'saving'}
            onPress={() => {
              void save();
            }}
            accessibilityHint="Saves the routine and opens it"
          />
        }
        // The back button goes through the same guard as the gesture; `DetailScreen` calls
        // this instead of calling `router.back()` itself.
        onBack={() => {
          if (isDraftDirty()) setConfirmDiscard(true);
          else router.dismiss();
        }}
      >
        {(topInset, header) => (
          <KeyboardAvoid style={{ flex: 1 }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              onScroll={header.onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{
                // `topInset` is the translucent header's height, and this screen was the only
                // one of eleven that threw it away for a flat 16pt. The header then covered the
                // first ~105pt of content, which on THIS screen is the routine's name field, // so "New routine" opened with its first and most important input hidden, and
                // no amount of scrolling revealed it because the list was already at offset 0.
                // A routine saved without a name falls back to being named after its first
                // exercise, which is how a QA run produced a routine called "Squat (Stacchi)".
                paddingTop: topInset + spacing.lg,
                paddingBottom: insets.bottom + spacing.huge,
                gap: spacing.xxl,
              }}
            >
              <Column gap="md" style={{ paddingHorizontal: screenGutter }}>
                <TextField
                  label="Routine name"
                  value={draft.name}
                  onChangeText={setDraftName}
                  placeholder="Push Day, Thursday Run, Full Body B"
                  hint={
                    draft.name.trim().length === 0 && draft.items.length > 0
                      ? 'Leave it blank and the routine is named after its first exercise.'
                      : 'Shows on the Workout tab, and beside every session in your history.'
                  }
                  returnKeyType="next"
                  accessibilityHint="Names the routine"
                />
                <TextField
                  label="Notes"
                  value={draft.description}
                  onChangeText={setDraftDescription}
                  placeholder="Optional: how the session should feel, what to leave at the gym"
                  multiline
                  accessibilityHint="Adds an optional description"
                />
              </Column>

              {rows.length === 0 ? (
                <EmptyState
                  icon="listAdd"
                  title="No exercises yet"
                  message="A routine is a list of exercises with targets. Add the first one from the library: it is searched live, and everything you choose is frozen into the routine so it still opens with no signal."
                  actionLabel="Add exercise"
                  onAction={() => {
                    haptics.light();
                    setPickerOpen(true);
                  }}
                />
              ) : (
                <Column gap="md">
                  <SectionHeader
                    title="Exercises"
                    eyebrow={`${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
                    action={
                      <Button
                        label="Add"
                        variant="quiet"
                        size="sm"
                        icon="plus"
                        onPress={() => {
                          haptics.light();
                          setPickerOpen(true);
                        }}
                      />
                    }
                  />
                  {/* No Card: `ListRow` carries its own horizontal padding and hairline, so a
                      bordered box around it would inset the dividers short of the edges. */}
                  <View>
                    {rows.map((row, index) => (
                      <RoutineItemRow
                        key={row.item.id}
                        item={row.item}
                        snapshot={row.snapshot}
                        units={units}
                        position={{
                          index,
                          count: rows.length,
                          onMove: (to) => moveDraftItem(index, to),
                        }}
                        onPress={() => setEditorItemId(row.item.id)}
                        onLongPress={() => setEditorItemId(row.item.id)}
                        onRemove={() => {
                          haptics.light();
                          removeDraftItem(row.item.id);
                        }}
                      />
                    ))}
                  </View>
                  <Row gap="xxl" style={{ paddingHorizontal: screenGutter }}>
                    <MetricNote
                      label="Planned volume"
                      value={
                        volumeKg === 0
                          ? 'Bodyweight'
                          : `${trimNumber(weightValue(volumeKg, units), 0)} ${weightUnit(units)}`
                      }
                    />
                    <MetricNote label="Est. time" value={`~${minutes} min`} />
                  </Row>
                  <Txt variant="caption" tone="faint" style={{ paddingHorizontal: screenGutter }}>
                    Tap a row to change its sets, reps, weight or rest. The arrows reorder it,
                    and Done writes every row at once.
                  </Txt>
                </Column>
              )}

              {blocked === null ? null : (
                <Card tone="sunken" padding="md" style={{ marginHorizontal: spacing.lg }}>
                  <Row gap="sm" align="start">
                    <Icon name="warning" size={17} color={theme.colors.danger} />
                    <Txt variant="body" style={{ flex: 1 }}>
                      {blocked}
                    </Txt>
                  </Row>
                </Card>
              )}
            </ScrollView>
          </KeyboardAvoid>
        )}
      </DetailScreen>

      {editorItem === null ? null : (
        <ItemEditorSheet
          item={editorItem}
          snapshot={snapshotByExerciseId.get(editorItem.exerciseId) ?? null}
          units={units}
          defaultRestSeconds={defaultRest}
          onChange={(patch) => updateDraftItem(editorItem.id, patch)}
          onRemove={() => {
            removeDraftItem(editorItem.id);
            setEditorItemId(null);
          }}
          onRequestClose={() => setEditorItemId(null)}
        />
      )}

      {pickerOpen ? (
        <ExercisePickerSheet
          isIncluded={containsExercise}
          onPick={(exercise) => {
            addDraftExercise(exercise);
            haptics.success();
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      {confirmDiscard ? (
        <ConfirmSheet
          title="Discard this routine?"
          message={
            draft.items.length > 0
              ? `${draft.items.length} ${draft.items.length === 1 ? 'exercise' : 'exercises'} have not been saved. Nothing has been created yet, so discarding removes the whole draft.`
              : 'Nothing has been saved yet, so leaving now discards the name and notes.'
          }
          confirmLabel="Discard"
          onRequestClose={() => setConfirmDiscard(false)}
          onConfirm={() => {
            // Order matters: the guard reads the ref, so it must be raised before the
            // navigation starts or the dismiss would prompt itself again.
            discardConfirmed.current = true;
            setConfirmDiscard(false);
            clearDraft();
            router.dismiss();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ pieces -- */

function MetricNote({ label, value }: { label: string; value: string }) {
  return (
    <Column gap="xxs">
      <Txt variant="micro" tone="faint" uppercase tracking={0.6}>
        {label}
      </Txt>
      <Txt variant="strong">{value}</Txt>
    </Column>
  );
}
