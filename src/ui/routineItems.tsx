/**
 * The routine item row and its editor, shared by both routine screens.
 *
 * ## Extracted because two screens would otherwise diverge
 *
 * The builder and the routine screen show the same row, and the difference between them
 * is *actions*, not appearance: a draft can be moved and deleted in memory, a saved item
 * can be moved and deleted through a mutation. Those arrive as optional callbacks, so
 * each screen renders exactly the controls it can perform, and neither owns a private
 * copy of the typography, the thumbnail fallback or the metric rhythm. Two copies of
 * that drift within a week, and the drift is the kind nobody notices until both screens
 * are open on the same routine.
 *
 * ## Reordering is buttons, not a drag
 *
 * Considered and rejected: a drag-to-reorder row. Building one means a pan gesture that
 * does not steal the list's own vertical scroll, a translating row that must not fight
 * FlashList's recycling, and haptics at the right moment: every one of them a class of
 * bug that only surfaces on a device under a real thumb. `ListRow` already forwards
 * `onLongPress`, so the honest long-press menu is available with no gesture code at all.
 * Up/down controls are the same operation, reachable one-handed, work in a screen reader,
 * and cannot mis-fire during a scroll. If a drag earns its keep later it goes here, in
 * one place, and this paragraph is where that decision gets reversed.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ExerciseThumb, ListRow } from '@/ui/rows';
import { Icon, ICON_SIZE, type IconName } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import { Stepper } from '@/ui/controls/Stepper';
import { TextInput } from '@/ui/controls/TextInput';
import { FormFooter, FormSection } from '@/ui/FormSheet';
import { Button } from '@/ui/controls/Button';
import { MetaLine } from '@/ui/display/MetaLine';
import { TagRow } from '@/ui/display/TagRow';
import { exerciseTags } from '@/ui/display/exerciseTags';
import { SwipeToDelete } from '@/ui/SwipeToDelete';
import { Image } from 'expo-image';
import { useExerciseResolution } from '@/queries/useExercises';
import { haptics } from '@/services/haptics';
import { useAppTheme, type Theme } from '@/theme/theme';
import { palette, spacing, touchTarget } from '@/theme/tokens';
import {
  formatWeight,
  repsFromRange,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
  type UnitSystem,
} from '@/utils/format';
import type { ExerciseSnapshot, RoutineItem } from '@/domain/types';
import type { ItemTarget } from '@/routines/draft';
import { ITEM_BOUNDS } from '@/transfer/format';
import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';
import type { MetaItem, Tag } from '@/ui/display/types';

/**
 * One exercise in a routine: thumbnail, name, sets, reps and load as items, the primary muscle
 * as a tag.
 *
 * List discipline, like `rows.tsx`: `theme` arrives as a prop, and every callback takes the
 * item's id or index, so a screen passes the same three functions to every row instead of
 * building a closure per row per render. That is what lets `memo` skip the rows a stepper
 * press did not touch.
 */
export const RoutineItemRow = memo(function RoutineItemRow({
  item,
  snapshot,
  units,
  theme,
  index,
  count,
  onOpen,
  onMove,
  onRemove,
  topDivider = true,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  theme: Theme;
  /** Where the row sits, so the first and last row can disable the impossible move. */
  index: number;
  count: number;
  /** Opens the editor. Absent makes the row inert, which is right for a preview. */
  onOpen?: (itemId: string) => void;
  /** Present in an ordered list; called with this row's index and the one it moves to. */
  onMove?: (from: number, to: number) => void;
  /** Replaces the chevron with a trash control. */
  onRemove?: (itemId: string) => void;
  topDivider?: boolean;
}) {
  const { t } = useT();
  const meta = useMemo(() => itemMeta(item, units), [item, units]);
  const tags = useMemo<Tag[] | undefined>(
    () =>
      snapshot?.primaryMuscles[0]
        ? [{ key: 'muscle', label: snapshot.primaryMuscles[0] }]
        : undefined,
    [snapshot],
  );
  const open = useCallback(() => onOpen?.(item.id), [onOpen, item.id]);
  const up = useCallback(() => onMove?.(index, index - 1), [onMove, index]);
  const down = useCallback(() => onMove?.(index, index + 1), [onMove, index]);
  const remove = useCallback(() => onRemove?.(item.id), [onRemove, item.id]);

  const row = (
    <ListRow
      theme={theme}
      title={item.exerciseName}
      // The exercise's cue, in full in the editor and on the workout card; one line here.
      {...(item.notes ? { description: item.notes, descriptionLines: 1 } : {})}
      meta={meta}
      {...(tags ? { tags } : {})}
      {...(onOpen === undefined
        ? {}
        : { onPress: open, onLongPress: open, accessibilityHint: t('itemEditor.editHint') })}
      leading={
        <ExerciseThumb
          uri={snapshot === null ? null : (snapshot.thumbnailUrl ?? snapshot.imageUrl)}
          name={item.exerciseName}
          size={44}
          theme={theme}
        />
      }
      trailing={
        <View style={styles.trailing}>
          {onMove ? (
            <>
              <RowButton
                icon="chevronUp"
                label={t('routineItemA11y.moveUp', { name: item.exerciseName })}
                disabled={index === 0}
                theme={theme}
                onPress={up}
              />
              <RowButton
                icon="chevronDown"
                label={t('routineItemA11y.moveDown', { name: item.exerciseName })}
                disabled={index >= count - 1}
                theme={theme}
                onPress={down}
              />
            </>
          ) : null}
          {onRemove ? (
            <RowButton
              icon="trash"
              label={t('routineItemA11y.remove', { name: item.exerciseName })}
              tone="danger"
              theme={theme}
              onPress={remove}
            />
          ) : onMove ? null : (
            <Icon name="chevronRight" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
          )}
        </View>
      }
    />
  );

  return (
    <View
      style={topDivider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline } : undefined}
    >
      {onRemove ? (
        <SwipeToDelete theme={theme} onDelete={remove}>
          {row}
        </SwipeToDelete>
      ) : (
        row
      )}
    </View>
  );
});

/**
 * A quiet trailing control: a 44pt target, an inline glyph, no disc.
 *
 * `IconButton` draws a filled circle, and a row with two filled circles in it reads as a
 * toolbar rather than as one row with controls. Disabled rows keep the glyph and lose the
 * press, so the shape of the control never shifts when the ends of the list change.
 */
function RowButton({
  icon,
  label,
  onPress,
  disabled = false,
  tone = 'muted',
  theme,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'muted' | 'danger';
  theme: Theme;
}) {
  const color = disabled
    ? theme.colors.textFaint
    : tone === 'danger'
      ? theme.colors.danger
      : theme.colors.textMuted;
  return (
    <Pressable
      onPress={() => {
        if (tone === 'danger') haptics.light();
        else haptics.selection();
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        styles.rowButton,
        { opacity: pressed && !disabled ? 0.45 : disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={icon} size={ICON_SIZE.inline} color={color} />
    </Pressable>
  );
}

/**
 * Editing one exercise's targets.
 *
 * ## No OK button, because every press commits
 *
 * The steppers write through, so this sheet is a surface for adjusting rather than a form
 * to submit: closing it *is* committing. That is what makes it safe on the saved-routine
 * screen, where each press goes straight to SQLite: there is no half-entered state for a
 * backdrop tap or the back gesture to interrupt, and no "discard changes?" prompt to get
 * wrong. A text field for weight would need a Done key, a blur, and a rule for what "62."
 * means when the sheet closes mid-keystroke.
 *
 * ## Weight is entered in the user's unit and converted exactly once
 *
 * On the way out, in the `onChange` that writes. Converting on the way in as well: and
 * again on close: is how a units-aware form ends up with a field reading 135 while the
 * stepper is quietly stepping kilograms.
 */
export const ItemEditorForm = memo(function ItemEditorForm({
  item,
  snapshot,
  units,
  onChange,
  onRemove,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  onChange: (patch: Partial<ItemTarget>) => void;
  onRemove?: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const step = weightStep(units);
  const displayWeight = weightDisplayValue(item.weightKg, units, step);
  // The current targets as items under the title, so the summary a row shows and the values
  // the steppers below are changing read the same way, and update together.
  const meta = useMemo(() => itemMeta(item, units), [item, units]);
  const libraryTags = useMemo<Tag[]>(
    () =>
      snapshot === null
        ? []
        : [
            ...exerciseTags(snapshot),
            ...snapshot.equipment.map((gear) => ({ key: `e:${gear}`, label: gear })),
          ],
    [snapshot],
  );

  return (
    <>
      <MetaLine items={meta} theme={theme} wrap />
      <FormSection title={t('itemEditor.sets')}>
        <Stepper
          label={t('itemEditor.sets')}
          value={item.sets}
          min={1}
          max={20}
          step={1}
          onChange={(sets) => onChange({ sets })}
        />
      </FormSection>

      <FormSection title={t('itemEditor.reps')}>
        <Stepper
          label={t('itemEditor.reps')}
          value={repsFromRange(item.reps)}
          min={1}
          max={100}
          step={1}
          suffix={t('itemEditor.repsSuffix')}
          onChange={(reps) => onChange({ reps: String(reps) })}
        />
      </FormSection>

      <FormSection title={t('itemEditor.weightIn', { unit: weightUnit(units) })}>
        <Stepper
          label={t('itemEditor.weightPerSet', { unit: weightUnit(units) })}
          value={displayWeight}
          min={0}
          max={units === 'imperial' ? 1000 : 450}
          step={step}
          decimal
          onChange={(next) => onChange({ weightKg: weightFromDisplayValue(next, units) })}
        />
      </FormSection>

      <FormSection title={t('itemEditor.restBetweenSets')}>
        <Stepper
          label={t('itemEditor.restBetweenSets')}
          value={item.restSeconds}
          min={0}
          max={600}
          step={15}
          suffix="s"
          onChange={(restSeconds) => onChange({ restSeconds })}
        />
        {item.restSeconds === 0 ? (
          <Txt variant="micro" tone="faint">
            {t('itemEditor.zeroRestNote')}
          </Txt>
        ) : null}
      </FormSection>

      {/* No FormSection: the field draws its own label in the same style. */}
      <NoteField note={item.notes} onCommit={(notes) => onChange({ notes })} />

      <FormSection title={t('itemEditor.fromLibrary')}>
        {libraryTags.length > 0 ? <TagRow tags={libraryTags} theme={theme} /> : null}
        <ExerciseAbout exerciseId={item.exerciseId} />
      </FormSection>

      {onRemove === undefined ? null : (
        <FormFooter>
          <Button label={t('itemEditor.remove')} variant="danger" icon="trash" onPress={onRemove} />
        </FormFooter>
      )}
    </>
  );
});

/** The longest cue that still reads as one line on a row and a caption on the workout card. */
const NOTE_MAX = ITEM_BOUNDS.notesLength;
/** The counter appears here, so it is a warning near the limit rather than noise throughout. */
const NOTE_COUNT_FROM = 160;
const NOTE_SAVE_DELAY_MS = 500;

/**
 * The exercise's note, which is the cue shown on it mid-workout.
 *
 * Unlike the steppers it does not write on every change: a saved routine's write is a database
 * update plus a cache refresh, and a refresh landing mid-word would move the caret. The field
 * keeps its own text and commits it once typing pauses, and again when the sheet closes, so
 * nothing typed is lost to a swipe. Empty or whitespace-only is stored as no note.
 */
function NoteField({ note, onCommit }: { note: string | null; onCommit: (notes: string | null) => void }) {
  const { t } = useT();
  const [text, setText] = useState(note ?? '');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const flush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current === null) return;
    const trimmed = pending.current.trim();
    pending.current = null;
    commitRef.current(trimmed.length > 0 ? trimmed : null);
  }, []);
  useEffect(() => flush, [flush]);

  const change = useCallback(
    (next: string) => {
      setText(next);
      pending.current = next;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, NOTE_SAVE_DELAY_MS);
    },
    [flush],
  );

  return (
    <TextInput
      label={t('itemEditor.note')}
      value={text}
      onChangeText={change}
      placeholder={t('itemEditor.notePlaceholder')}
      hint={
        text.length >= NOTE_COUNT_FROM
          ? t('itemEditor.noteCount', { count: text.length, max: NOTE_MAX })
          : t('itemEditor.noteHint')
      }
      multiline
      maxLength={NOTE_MAX}
      autoCapitalize="sentences"
    />
  );
}

/* ------------------------------------------------------------------ helpers -- */

/**
 * Sets, reps and load, as three items.
 *
 * Weight is the only number here the unit setting changes, so it is the only one
 * formatted; reps and sets are unit-free. A missing snapshot costs the muscle tag and
 * nothing else: which is exactly why the exercise name is stored on the item.
 */
function itemMeta(item: RoutineItem, units: UnitSystem): MetaItem[] {
  const load = item.weightKg === 0 ? tr('itemEditor.bodyweightShort') : formatWeight(item.weightKg, units);
  return [
    { icon: 'layers', label: tr('workout.set', { count: item.sets }) },
    { icon: 'refresh', label: tr('details.repsValue', { reps: item.reps }) },
    {
      icon: 'dumbbell',
      label: load,
      ...(item.weightKg === 0 ? { a11y: tr('details.bodyweightA11y') } : {}),
    },
  ];
}

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  rowButton: {
    width: touchTarget * 0.8,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
} satisfies Record<string, ViewStyle>);

/**
 * What the library says about the exercise: its picture and its description, under the
 * targets so adjusting sets and reps never has to scroll past them.
 *
 * Read through `useExerciseResolution`, not the snapshot alone: a snapshot captured from a
 * search row often has no description and only a thumbnail, and the resolution fills both in
 * from wger (or from the stored copy offline). A missing description is said, not hidden.
 */
function ExerciseAbout({ exerciseId }: { exerciseId: string }) {
  const { t } = useT();
  const detail = useExerciseResolution(exerciseId);
  const exercise = detail.exercise;
  const image = exercise?.imageUrl ?? exercise?.thumbnailUrl ?? null;
  const instructions = exercise?.instructions?.trim() || null;

  if (detail.isLoading) {
    return (
      <Txt variant="caption" tone="faint">
        {t('itemEditor.loadingDetails')}
      </Txt>
    );
  }
  return (
    <View style={aboutStyles.about}>
      {image !== null ? (
        <View style={[aboutStyles.art, { backgroundColor: palette.white }]}>
          <Image
            source={{ uri: image }}
            recyclingKey={image}
            contentFit="contain"
            style={aboutStyles.image}
            accessibilityLabel={t('itemEditor.imageA11y', { name: exercise?.name ?? '' })}
          />
        </View>
      ) : null}
      <Txt variant="caption" tone={instructions ? 'muted' : 'faint'}>
        {instructions ??
          t(detail.fetchable ? 'exerciseDetail.noDescription' : 'exerciseDetail.unknownBuiltIn')}
      </Txt>
    </View>
  );
}

const aboutStyles = StyleSheet.create({
  about: { gap: spacing.md },
  // Technical drawings on a white card in both themes: most wger art is black line work on a
  // transparent background, which vanishes on the dark canvas.
  art: { borderRadius: spacing.md, overflow: 'hidden', padding: spacing.sm },
  image: { width: '100%', aspectRatio: 4 / 3 },
});
