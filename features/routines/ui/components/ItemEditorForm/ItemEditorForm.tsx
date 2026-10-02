import { memo } from 'react';
import {
  Button,
  ExerciseAbout,
  type ExerciseAboutContent,
  FormFooter,
  FormSection,
  MetaLine,
  NoteField,
  SetStepperRow,
  Stepper,
  TagRow,
  Txt,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { ItemChange } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { useItemEditorFormLogic } from '@/features/routines/ui/components/ItemEditorForm/ItemEditorForm.logic';

/**
 * Editing one exercise's targets. Every stepper press commits, so the sheet is a surface for
 * adjusting rather than a form to submit: closing it is committing, there is no half-entered state
 * for a swipe to interrupt, and no "discard changes?" to get wrong.
 */
export const ItemEditorForm = memo(function ItemEditorForm({
  item,
  snapshot,
  units,
  about,
  onChange,
  onRemove,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  /** The library's About block, read by the page. */
  about: ExerciseAboutContent;
  onChange: (change: ItemChange) => void;
  onRemove?: () => void;
}) {
  const { derived, effects } = useItemEditorFormLogic(item, snapshot, units, onChange);
  const { t } = useT();
  const theme = useAppTheme();

  return (
    <>
      <MetaLine items={derived.meta} theme={theme} wrap />
      <FormSection title={t('itemEditor.sets')}>
        {derived.rows.map((row, at) => (
          <SetStepperRow
            key={row.key}
            index={row.index}
            reps={row.reps}
            weight={row.weight}
            rpe={row.rpe}
            unit={derived.unit}
            repsBounds={derived.reps}
            rpeBounds={derived.rpe}
            weightMax={derived.weightMax}
            weightStep={derived.weightStep}
            rpeKind="target"
            completed={false}
            canRemove={derived.canRemoveSet}
            topDivider={at > 0}
            highlighted={false}
            theme={theme}
            onReps={effects.setReps}
            onWeight={effects.setWeight}
            onRpe={effects.setRpe}
            onRemove={effects.removeSet}
          />
        ))}
        <Txt variant="micro" tone="faint">
          {t('itemEditor.targetRpeNote')}
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
          value={item.restSeconds}
          min={derived.rest.min}
          max={derived.rest.max}
          step={15}
          suffix="s"
          onChange={effects.setRest}
        />
        {derived.zeroRest ? (
          <Txt variant="micro" tone="faint">
            {t('itemEditor.zeroRestNote')}
          </Txt>
        ) : null}
      </FormSection>

      <NoteField note={item.notes} maxLength={derived.noteMax} onCommit={effects.setNotes} />

      <FormSection title={t('itemEditor.fromLibrary')}>
        {derived.libraryTags.length > 0 ? <TagRow tags={derived.libraryTags} theme={theme} /> : null}
        <ExerciseAbout about={about} />
      </FormSection>

      {onRemove === undefined ? null : (
        <FormFooter>
          <Button label={t('itemEditor.remove')} variant="danger" icon="trash" onPress={onRemove} />
        </FormFooter>
      )}
    </>
  );
});
