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
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen, ScreenHeader } from '@/ui/Screen';
import { HeaderToolbar, headerAction } from '@/navigation/HeaderAction';
import { Button } from '@/ui/controls/Button';
import { Chip } from '@/ui/controls/Chip';
import { Stepper } from '@/ui/controls/Stepper';
import { KeyboardAvoid } from '@/ui/layout';
import { TextInput } from '@/ui/controls/TextInput';
import { Card, Row, Stack as Column } from '@/ui/layout';
import { SectionHeader, TagRow, exerciseTags } from '@/ui/display';
import { Txt, fontSizeOf, lineHeightOf } from '@/ui/Text';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { useScreenContentBottom } from '@/ui/insets';
import { EmptyState, SkeletonCard } from '@/ui/states';
import { ExerciseThumb } from '@/ui/rows';
import { useExerciseResolution } from '@/queries/useExercises';
import { useAddRoutineExercise, useRoutines, useSaveRoutine } from '@/queries/useRoutines';
import { useSettings } from '@/settings/hooks';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { radius, screenGutter, spacing } from '@/theme/tokens';
import { useT } from '@/i18n/useT';
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
  const { t } = useT();
  const params = useLocalSearchParams<{ id?: string }>();
  const theme = useAppTheme();
  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { routines, isLoading: routinesLoading } = useRoutines();
  const saveRoutine = useSaveRoutine();
  const addItem = useAddRoutineExercise();

  const exerciseId = firstParam(params.id);
  const detail = useExerciseResolution(exerciseId);
  const exercise = detail.exercise;
  const tags = useMemo(() => (exercise ? exerciseTags(exercise) : []), [exercise]);
  const bottom = useScreenContentBottom();

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
  const commit = useCallback(() => {
    void save();
  }, [save]);
  const dismiss = useCallback(() => router.dismiss(), []);

  return (
    <>
      <ScreenHeader title={t('addExercise.addToRoutineTitle')} />
      <HeaderToolbar placement="left">
        {headerAction({ action: 'cancel', onPress: dismiss, t })}
      </HeaderToolbar>
      {/* A text action, not a glyph: the commit here creates something, and a labelled
          action also shows its disabled state, which a dimmed glyph does not. */}
      <HeaderToolbar placement="right">
        {headerAction({
          action: 'save',
          onPress: commit,
          t,
          label: saving ? 'addExercise.adding' : 'addExercise.add',
          disabled: !canSave,
          variant: 'done',
          tint: theme.colors.accent,
        })}
      </HeaderToolbar>
      <Screen>
        <KeyboardAvoid style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: spacing.xxl, paddingBottom: bottom }}
          >
            {detail.isLoading ? (
              <View style={styles.section}>
                <SkeletonCard lines={3} />
              </View>
            ) : exercise === null ? (
              <View style={styles.section}>
                <EmptyState
                  icon="info"
                  title={t('addExercise.loadError')}
                  message={t('addExercise.loadErrorMessage')}
                  actionLabel={t('addExercise.goBack')}
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
                  <Column gap="xs" style={styles.flex}>
                    <Txt variant="title" numberOfLines={2}>
                      {exercise.name}
                    </Txt>
                    <TagRow tags={tags} theme={theme} max={3} />
                  </Column>
                </Row>

                <Column gap="md" style={styles.section}>
                  <SectionHeader
                    title={t('addExercise.routine')}
                    eyebrow={t('addExercise.whereItGoes')}
                  />
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
                        label={t('addExercise.newRoutine')}
                        icon="plus"
                        selected={effectiveTarget === NEW_ROUTINE}
                        onPress={() => setTarget(NEW_ROUTINE)}
                      />
                    </Row>
                  )}
                </Column>

                {effectiveTarget === NEW_ROUTINE ? (
                  <Column gap="md" style={styles.section}>
                    <SectionHeader title={t('addExercise.newRoutine')} />
                    <TextInput
                      label={t('addExercise.routineName')}
                      value={draft.name}
                      onChangeText={field('name')}
                      placeholder={t('addExercise.routineNamePlaceholder')}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        void save();
                      }}
                      autoCapitalize="words"
                      error={needsName ? t('addExercise.nameRequired') : null}
                      accessibilityHint={t('addExercise.nameHint')}
                    />
                    <TextInput
                      label={t('addExercise.description')}
                      value={draft.description}
                      onChangeText={field('description')}
                      placeholder={t('addExercise.descriptionPlaceholder')}
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
                        <Icon name="check" size={ICON_SIZE.inline} color={theme.colors.success} />
                        <Txt variant="body" style={styles.flex} numberOfLines={2}>
                          {t('addExercise.goingInto')}{' '}
                          <Txt variant="body" weight="700">
                            {targetRoutine?.name ?? t('addExercise.yourRoutine')}
                          </Txt>
                        </Txt>
                      </Row>
                    </Card>
                  </View>
                )}

                <Column gap="md" style={styles.section}>
                  <SectionHeader
                    title={t('addExercise.targets')}
                    eyebrow={t('addExercise.targetsEyebrow')}
                  />
                  {/* Top-aligned: Reps carries a hint line, and a centred row pushed Sets down. */}
                  <Row gap="md" align="start">
                    <TextInput
                      label={t('addExercise.sets')}
                      value={draft.sets}
                      onChangeText={field('sets')}
                      keyboardType="number-pad"
                      returnKeyType="next"
                      style={{ flex: 1 }}
                      maxLength={2}
                    />
                    <TextInput
                      label={t('addExercise.reps')}
                      value={draft.reps}
                      onChangeText={field('reps')}
                      returnKeyType="next"
                      style={{ flex: 1.4 }}
                      hint={t('addExercise.repsHint')}
                      maxLength={12}
                    />
                  </Row>

                  <Row gap="md" align="start">
                    <TextInput
                      label={t('addExercise.weightIn', { unit: weightUnit(units) })}
                      value={draft.weight}
                      onChangeText={field('weight')}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      unit={weightUnit(units)}
                      hint={t('addExercise.blankBodyweight')}
                      style={{ flex: 1 }}
                      maxLength={6}
                    />
                    <View style={styles.besideField}>
                      <Stepper
                        label={t('addExercise.weightPerSet', { unit: weightUnit(units) })}
                        compact
                        value={parseWeight(draft.weight, units)}
                        onChange={(next) =>
                          setDraft((d) => ({ ...d, weight: next === 0 ? '' : String(next) }))
                        }
                        min={0}
                        max={units === 'imperial' ? 1000 : 450}
                        step={weightStep(units)}
                        suffix={weightUnit(units)}
                      />
                    </View>
                  </Row>

                  <Row gap="md" align="start">
                    <TextInput
                      label={t('addExercise.rest')}
                      value={draft.rest}
                      onChangeText={field('rest')}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      unit="s"
                      hint={t('addExercise.blankUsesDefault', { seconds: defaultRest })}
                      style={{ flex: 1 }}
                      maxLength={4}
                    />
                    <View style={styles.besideField}>
                      <Stepper
                        label={t('addExercise.restBetweenSets')}
                        compact
                        value={clampInt(draft.rest, 0, 600, defaultRest)}
                        onChange={(next) => setDraft((d) => ({ ...d, rest: String(next) }))}
                        min={0}
                        max={600}
                        step={15}
                        suffix="s"
                      />
                    </View>
                  </Row>

                  <TextInput
                    label={t('addExercise.cue')}
                    value={draft.notes}
                    onChangeText={field('notes')}
                    placeholder={t('addExercise.notesPlaceholder')}
                    returnKeyType="done"
                    autoCapitalize="sentences"
                    multiline
                    style={styles.multiline}
                  />
                </Column>

                <Column gap="md" style={styles.section}>
                  <Button
                    label={
                      t(
                        effectiveTarget === NEW_ROUTINE
                          ? 'addExercise.createAndAdd'
                          : 'addExercise.addToRoutine',
                      )
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
                      t(
                        effectiveTarget === NEW_ROUTINE
                          ? 'addExercise.createHint'
                          : 'addExercise.addToRoutineHint',
                      )
                    }
                  />
                  <Txt variant="caption" tone="faint" align="center">
                    {t('addExercise.targetsNote')}
                  </Txt>
                </Column>
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
  section: { paddingHorizontal: screenGutter },
  flex: { flex: 1 },
  /**
   * A stepper beside a text field starts where the field's box starts: below the field's
   * label line and the gap under it (`TextInput`'s label is `micro`, its column gap `xs`), so
   * the two controls share a top edge instead of centring against the hint underneath.
   */
  besideField: { paddingTop: Math.round(fontSizeOf('micro') * lineHeightOf('micro')) + spacing.xs },
  multiline: { minHeight: 76, paddingTop: spacing.md, paddingBottom: spacing.md, textAlignVertical: 'top' },
});
