import { memo, type Ref } from 'react';
import type { View } from 'react-native';
import {
  Button,
  FormSection,
  MetaLine,
  SetStepperRow,
  Stepper,
  type Tag,
  TagRow,
  Txt,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import { ExerciseAbout, NoteField } from '@/features/exercises/pages';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import {
  type ExerciseEditorWriters,
  useExerciseEditorFormLogic,
} from '@/features/workouts/ui/components/ExerciseEditorForm/ExerciseEditorForm.logic';

/**
 * Editing one exercise of the workout, laid out like the routine item sheet so the app has one
 * way to edit an exercise's sets: the summary, every set as a stepper row with its done state,
 * add and remove set, the rest, the note and the library's About block. Every press writes
 * through, so closing the sheet is committing. The set the sheet was opened from is highlighted
 * and carries `highlightRef`, which the sheet scrolls to. Ticking a set stays on the session's
 * list: that is the one-handed gesture between sets, and this sheet is for changing the plan.
 */
export const ExerciseEditorForm = memo(function ExerciseEditorForm({
  entry,
  units,
  tags,
  highlightedSet,
  highlightRef,
  ...writers
}: ExerciseEditorWriters & {
  entry: StrengthEntry;
  units: UnitSystem;
  /** The library's tags for the exercise, read by the page. */
  tags: readonly Tag[];
  highlightedSet: number | null;
  highlightRef: Ref<View>;
}) {
  const { derived, effects } = useExerciseEditorFormLogic(entry, units, writers);
  const { t } = useT();
  const theme = useAppTheme();

  return (
    <>
      <MetaLine items={derived.meta} theme={theme} wrap />
      <FormSection title={t('itemEditor.sets')}>
        {derived.rows.map((row, at) => (
          <SetStepperRow
            key={row.key}
            ref={row.index === highlightedSet ? highlightRef : undefined}
            index={row.index}
            reps={row.reps}
            weight={row.weight}
            rpe={row.rpe}
            unit={derived.unit}
            repsBounds={derived.reps}
            rpeBounds={derived.rpe}
            weightMax={derived.weightMax}
            weightStep={derived.weightStep}
            rpeKind="logged"
            completed={row.completed}
            canRemove={derived.canRemoveSet}
            topDivider={at > 0}
            highlighted={row.index === highlightedSet}
            theme={theme}
            onReps={effects.setReps}
            onWeight={effects.setWeight}
            onRpe={effects.setRpe}
            onRemove={effects.removeSet}
          />
        ))}
        <Txt variant="micro" tone="faint">
          {t('setRow.rpeNote')}
        </Txt>
        <Button
          label={t('itemEditor.addSet')}
          variant="secondary"
          icon="plus"
          disabled={!derived.canAddSet}
          onPress={effects.addSet}
        />
      </FormSection>

      <FormSection title={t('itemEditor.restBetweenSets')}>
        <Stepper
          label={t('itemEditor.restBetweenSets')}
          value={entry.restSeconds}
          min={derived.rest.min}
          max={derived.rest.max}
          step={15}
          suffix="s"
          onChange={effects.setRest}
        />
        <Txt variant="micro" tone="faint">
          {t(derived.zeroRest ? 'itemEditor.zeroRestNote' : 'exerciseEditor.restAppliesNext')}
        </Txt>
      </FormSection>

      <NoteField note={entry.notes} onCommit={effects.setNotes} />

      <FormSection title={t('itemEditor.fromLibrary')}>
        {tags.length > 0 ? <TagRow tags={tags} theme={theme} /> : null}
        <ExerciseAbout exerciseId={entry.exerciseId} />
      </FormSection>
    </>
  );
});
