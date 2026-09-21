/**
 * Add an exercise to a routine: the bridge between the remote library and the user's
 * own training.
 *
 * ## Reached as a modal, not a sheet
 *
 * `app/exercise/_layout.tsx` presents this route with `presentation: 'modal'`, and that
 * choice is load-bearing for two reasons the layout's header explains: the keyboard gets
 * the standard modal treatment on both platforms, and on success this screen can put a
 * routine *over itself* rather than dismiss into a stack it cannot see. Both stop being
 * true if this becomes a sheet, so the route shape is part of the behaviour.
 *
 * ## The exercise arrives by id, and the store is written in the same breath
 *
 * `useAddRoutineExercise` freezes an `ExerciseSnapshot` into the same transaction that
 * inserts the item: which is the entire reason a routine still opens on a plane. The
 * consequence for this screen is that the exercise has to be a resolved `Exercise`
 * before saving, so it resolves through the same hook the detail screen uses rather than
 * trusting the name that arrived in the params.
 *
 * The corollary is the honest failure: **no exercise, no save.** A row that recorded an
 * id and nothing else would produce a routine item reading "Unknown exercise" forever,
 * unrepairable later because there is no snapshot to repair it from.
 *
 * ## One number, in one unit
 *
 * Weight is typed as text (tapping a stepper to 62.5 kg is tedious) but stored as
 * kilograms. Both facts are kept straight by doing everything the user sees in *their*
 * unit: the field, the stepper, the step grid: and converting exactly once, at the
 * moment the item is built. Mixing the two is the classic bug in a units-aware form: the
 * field says 135, the stepper is secretly stepping in kilograms, and the third tap
 * produces 182.
 */
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/ui/Screen';
import { Button, IconButton } from '@/ui/Button';
import { Chip, Stepper } from '@/ui/controls';
import { KeyboardAvoid, TextField } from '@/ui/TextField';
import { Card, Gap, Row, SectionHeader, Stack as Column } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { EmptyState, SkeletonCard } from '@/ui/states';
import { ExerciseThumb } from '@/ui/rows';
import { useExerciseResolution } from '@/queries/useExercises';
import { useAddRoutineExercise, useRoutines, useSaveRoutine } from '@/queries/useRoutines';
import { useSettings } from '@/settings/hooks';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';
import {
  parseNumber,
  toKilograms,
  weightStep,
  weightUnit,
  type UnitSystem,
} from '@/utils/format';

/** The target routine's id, or the sentinel for "create one on save". */
const NEW_ROUTINE = 'new';

type Draft = {
  name: string;
  description: string;
  sets: string;
  reps: string;
  /** In the user's unit, exactly as typed. */
  weight: string;
  rest: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  sets: '3',
  reps: '8-12',
  weight: '',
  rest: '',
  notes: '',
};

export default function AddExerciseScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { routines, isLoading: routinesLoading } = useRoutines();
  const saveRoutine = useSaveRoutine();
  const addItem = useAddRoutineExercise();

  const exerciseId = firstParam(params.id);
  const detail = useExerciseResolution(exerciseId);
  const exercise = detail.exercise;

  const [target, setTarget] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  // The list is empty while it loads, so the default target is resolved at render
  // rather than in `useState`: seeding it from a loading-time array would pin the
  // sentinel and then show "New routine" selected next to a list of real routines.
  const effectiveTarget =
    target !== null && routines.some((routine) => routine.id === target)
      ? target
      : (routines[0]?.id ?? NEW_ROUTINE);
  const targetRoutine = routines.find((routine) => routine.id === effectiveTarget) ?? null;

  const field = useCallback(
    (key: keyof Draft) => (next: string) => setDraft((d) => ({ ...d, [key]: next })),
    [],
  );

  const saving = saveRoutine.isPending || addItem.isPending;
  const needsName = effectiveTarget === NEW_ROUTINE && draft.name.trim().length === 0;
  const canSave = exercise !== null && !detail.isLoading && !needsName && !saving;

  const save = useCallback(async () => {
    if (exercise === null || saving) return;
    const name = draft.name.trim();
    if (effectiveTarget === NEW_ROUTINE && name.length === 0) return;

    const displayWeight = parseWeight(draft.weight, units);
    const item = {
      sets: clampInt(draft.sets, 1, 20, 3),
      reps: draft.reps.trim().length > 0 ? draft.reps.trim() : '8-12',
      // The only unit conversion on the screen.
      weightKg: toKilograms(displayWeight, units),
      // Never zero-by-accident: `0` is the engine's "this exercise starts no rest
      // timer", a real preference that must not be the default of a field the user
      // left blank. Blank means "whatever I set in Settings".
      restSeconds: clampInt(draft.rest, 0, 600, defaultRest),
      notes: draft.notes.trim().length > 0 ? draft.notes.trim() : null,
    };

    try {
      if (effectiveTarget === NEW_ROUTINE) {
        // `undefined`, not a guessed id: `routineRepository.save` mints one and
        // returns it, and an id invented here could collide with a routine the user
        // deleted whose row is still referenced by an in-flight query.
        const saved = await saveRoutine.mutateAsync({
          name,
          description: draft.description.trim().length > 0 ? draft.description.trim() : null,
          items: [],
        });
        await addItem.mutateAsync({ routineId: saved.id, exercise, item });
        // `replace`, not `push`: this screen exists only to create the routine. Left
        // underneath it, "back" would land on a form that has already been submitted.
        router.replace(routes.routine(saved.id));
        return;
      }

      await addItem.mutateAsync({ routineId: effectiveTarget, exercise, item });
      // `dismissTo`, not `back`: this screen is one deep from a routine and two deep
      // from the exercise detail, and walking a variable-depth stack out with `back`
      // is guesswork. This unwinds to the routine if it is on the stack and replaces
      // this screen with it if it is not.
      router.dismissTo(routes.routine(effectiveTarget));
    } catch {
      // Both mutations surface their own `isError`, and the button's label is the
      // user's feedback; swallowing here keeps an unhandled rejection out of the
      // error boundary for something the form can simply be re-tapped to retry.
    }
  }, [addItem, defaultRest, draft, effectiveTarget, exercise, saveRoutine, saving, units]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <KeyboardAvoid style={{ flex: 1 }}>
          <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
            <IconButton
              name="close"
              size={20}
              variant="surface"
              accessibilityLabel="Cancel and go back"
              onPress={() => router.dismiss()}
            />
            <Txt variant="subhead" weight="700" style={{ flex: 1 }} numberOfLines={1}>
              Add to routine
            </Txt>
            {/* A text button, not a round icon: the commit here creates something, and
                "close" and "add" as two identical discs six centimetres apart is a
                mis-tap waiting to happen. A labelled button also shows its disabled
                state; a dimmed glyph does not. */}
            <Button
              label={saving ? 'Adding…' : 'Add'}
              variant="ghost"
              size="sm"
              onPress={() => {
                void save();
              }}
              disabled={!canSave}
              accessibilityHint="Saves the exercise into the chosen routine"
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: spacing.xxl, paddingBottom: spacing.huge }}
          >
            {detail.isLoading ? (
              <View style={styles.section}>
                <SkeletonCard lines={3} />
              </View>
            ) : exercise === null ? (
              <View style={styles.section}>
                <EmptyState
                  icon="info"
                  title="This exercise could not be loaded"
                  message="The app has to know an exercise before it can be added: otherwise the routine would save an item with no name, no instructions and no picture, permanently."
                  actionLabel="Go back"
                  onAction={() => router.dismiss()}
                />
              </View>
            ) : (
              <Column gap="xxl">
                <Row gap="lg" align="center" style={styles.section}>
                  <ExerciseThumb
                    uri={exercise.thumbnailUrl ?? exercise.imageUrl}
                    name={exercise.name}
                    size={64}
                    theme={theme}
                    rounded={radius.lg}
                  />
                  <Column gap="xxs" style={{ flex: 1 }}>
                    <Txt variant="title" numberOfLines={2}>
                      {exercise.name}
                    </Txt>
                    <Txt variant="caption" tone="muted" numberOfLines={1}>
                      {exercise.primaryMuscles.length > 0
                        ? exercise.primaryMuscles.join(', ')
                        : (exercise.category ?? 'Exercise')}
                    </Txt>
                  </Column>
                </Row>

                <Column gap="md" style={styles.section}>
                  <SectionHeader title="Routine" eyebrow="Where it goes" />
                  {routinesLoading ? (
                    <SkeletonCard lines={1} />
                  ) : (
                    <Row gap="sm" wrap>
                      {routines.map((routine) => (
                        <Chip
                          key={routine.id}
                          label={routine.name}
                          count={routine.items.length}
                          selected={effectiveTarget === routine.id}
                          onPress={() => setTarget(routine.id)}
                        />
                      ))}
                      <Chip
                        label="New routine"
                        icon="plus"
                        selected={effectiveTarget === NEW_ROUTINE}
                        onPress={() => setTarget(NEW_ROUTINE)}
                      />
                    </Row>
                  )}
                </Column>

                {effectiveTarget === NEW_ROUTINE ? (
                  <Column gap="md" style={styles.section}>
                    <SectionHeader title="New routine" />
                    <TextField
                      label="Routine name"
                      value={draft.name}
                      onChangeText={field('name')}
                      placeholder="Push Day"
                      placeholderTextColor={theme.colors.textFaint}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        void save();
                      }}
                      blurOnSubmit
                      autoCapitalize="words"
                      autoComplete="off"
                      error={needsName ? 'Give the routine a name' : null}
                      accessibilityHint="Required. The name this routine shows in your list."
                    />
                    <TextField
                      label="Description"
                      value={draft.description}
                      onChangeText={field('description')}
                      placeholder="Optional: what this session is for"
                      placeholderTextColor={theme.colors.textFaint}
                      returnKeyType="done"
                      autoCapitalize="sentences"
                      multiline
                      style={styles.multiline}
                    />
                  </Column>
                ) : (
                  // The field is removed rather than disabled: the routine already
                  // has a name, and a box the user cannot type into is worse than
                  // the one line that says where the exercise is going.
                  <View style={styles.section}>
                    <Card tone="sunken">
                      <Row gap="md" align="center">
                        <Icon name="check" size={18} color={theme.colors.success} />
                        <Txt variant="body" style={{ flex: 1 }} numberOfLines={2}>
                          Going into{' '}
                          <Txt variant="body" weight="700">
                            {targetRoutine?.name ?? 'your routine'}
                          </Txt>
                        </Txt>
                      </Row>
                    </Card>
                  </View>
                )}

                <Column gap="md" style={styles.section}>
                  <SectionHeader title="Targets" eyebrow="What you plan to do" />
                  <Row gap="md">
                    <TextField
                      label="Sets"
                      value={draft.sets}
                      onChangeText={field('sets')}
                      keyboardType="number-pad"
                      returnKeyType="next"
                      style={{ flex: 1 }}
                      maxLength={2}
                    />
                    <TextField
                      label="Reps"
                      value={draft.reps}
                      onChangeText={field('reps')}
                      returnKeyType="next"
                      style={{ flex: 1.4 }}
                      hint="A range is fine"
                      maxLength={12}
                    />
                  </Row>

                  <Row gap="md" align="center">
                    <TextField
                      label={`Weight (${weightUnit(units)})`}
                      value={draft.weight}
                      onChangeText={field('weight')}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      unit={weightUnit(units)}
                      hint="Blank means bodyweight"
                      style={{ flex: 1 }}
                      maxLength={6}
                    />
                    <Stepper
                      label={`Weight per set in ${weightUnit(units)}`}
                      compact
                      value={parseWeight(draft.weight, units)}
                      onChange={(next) =>
                        setDraft((d) => ({ ...d, weight: next === 0 ? '' : String(next) }))
                      }
                      min={0}
                      max={units === 'imperial' ? 1000 : 450}
                      step={weightStep(units)}
                      suffix={weightUnit(units)}
                      style={{ paddingTop: 22 }}
                    />
                  </Row>

                  <Row gap="md" align="center">
                    <TextField
                      label="Rest"
                      value={draft.rest}
                      onChangeText={field('rest')}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      unit="s"
                      hint={`Blank uses ${defaultRest}s`}
                      style={{ flex: 1 }}
                      maxLength={4}
                    />
                    <Stepper
                      label="Rest between sets"
                      compact
                      value={clampInt(draft.rest, 0, 600, defaultRest)}
                      onChange={(next) => setDraft((d) => ({ ...d, rest: String(next) }))}
                      min={0}
                      max={600}
                      step={15}
                      suffix="s"
                      style={{ paddingTop: 22 }}
                    />
                  </Row>

                  <TextField
                    label="Cue"
                    value={draft.notes}
                    onChangeText={field('notes')}
                    placeholder="Tempo, grip, or a reminder for yourself"
                    placeholderTextColor={theme.colors.textFaint}
                    returnKeyType="done"
                    autoCapitalize="sentences"
                    multiline
                    style={styles.multiline}
                  />
                </Column>

                <Column gap="md" style={styles.section}>
                  <Button
                    label={
                      effectiveTarget === NEW_ROUTINE ? 'Create routine and add' : 'Add to routine'
                    }
                    icon="plus"
                    onPress={() => {
                      void save();
                    }}
                    loading={saving}
                    disabled={!canSave}
                    weighty
                    fullWidth
                    accessibilityHint={
                      effectiveTarget === NEW_ROUTINE
                        ? 'Creates the routine and opens it'
                        : 'Adds the exercise and opens the routine'
                    }
                  />
                  <Txt variant="caption" tone="faint" align="center">
                    Targets are a plan, not a limit: every set can be changed while you train.
                  </Txt>
                </Column>
                <Gap size={Platform.OS === 'ios' ? spacing.md : spacing.xl} />
              </Column>
            )}
          </ScrollView>
        </KeyboardAvoid>
      </Screen>
    </>
  );
}

/* ------------------------------------------------------------------ helpers -- */

/** A param can arrive as `string | string[]`; the first is the one the router set. */
function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  return null;
}

/**
 * Weight text → a number **in the user's own unit**, snapped to the plate grid.
 *
 * The snap is what keeps the typed field and the stepper telling the same story:
 * without it, typing 62 in imperial gets a field that says 62 while the + button
 * produces 64.5, and the two never agree again. A deliberate sub-step entry rounds
 * to the nearest plate someone can actually load.
 */
function parseWeight(input: string, units: UnitSystem): number {
  const raw = parseNumber(input);
  if (raw === null || raw <= 0) return 0;
  const step = weightStep(units);
  const snapped = Math.round(raw / step) * step;
  return Math.max(0, Number(snapped.toFixed(step < 1 ? 2 : 0)));
}

/** Integer field with a bound and a fallback for blank or unparseable input. */
function clampInt(input: string, min: number, max: number, fallback: number): number {
  const parsed = parseNumber(input);
  if (parsed === null) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  section: { paddingHorizontal: spacing.xl },
  multiline: { minHeight: 76, paddingTop: spacing.md, paddingBottom: spacing.md, textAlignVertical: 'top' },
});
