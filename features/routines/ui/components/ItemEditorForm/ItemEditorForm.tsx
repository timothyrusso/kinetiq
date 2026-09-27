import { memo } from 'react';
import { Button, FormFooter, FormSection, MetaLine, Stepper, TagRow, Txt } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { ExerciseAbout } from '@/features/routines/ui/components/ExerciseAbout/ExerciseAbout';
import { useItemEditorFormLogic } from '@/features/routines/ui/components/ItemEditorForm/ItemEditorForm.logic';
import { NoteField } from '@/features/routines/ui/components/NoteField/NoteField';

/**
 * Editing one exercise's targets. Every stepper press commits, so the sheet is a surface for
 * adjusting rather than a form to submit: closing it is committing, there is no half-entered state
 * for a swipe to interrupt, and no "discard changes?" to get wrong.
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
  const { derived, effects } = useItemEditorFormLogic(item, snapshot, units, onChange);
  const { t } = useT();
  const theme = useAppTheme();

  return (
    <>
      <MetaLine items={derived.meta} theme={theme} wrap />
      <FormSection title={t('itemEditor.sets')}>
        <Stepper label={t('itemEditor.sets')} value={item.sets} min={1} max={20} step={1} onChange={effects.setSets} />
      </FormSection>

      <FormSection title={t('itemEditor.reps')}>
        <Stepper
          label={t('itemEditor.reps')}
          value={derived.reps}
          min={1}
          max={100}
          step={1}
          suffix={t('itemEditor.repsSuffix')}
          onChange={effects.setReps}
        />
      </FormSection>

      <FormSection title={t('itemEditor.weightIn', { unit: derived.unit })}>
        <Stepper
          label={t('itemEditor.weightPerSet', { unit: derived.unit })}
          value={derived.weight}
          min={0}
          max={derived.weightMax}
          step={derived.weightStep}
          decimal
          onChange={effects.setWeight}
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
          onChange={effects.setRest}
        />
        {derived.zeroRest ? (
          <Txt variant="micro" tone="faint">
            {t('itemEditor.zeroRestNote')}
          </Txt>
        ) : null}
      </FormSection>

      <NoteField note={item.notes} onCommit={effects.setNotes} />

      <FormSection title={t('itemEditor.fromLibrary')}>
        {derived.libraryTags.length > 0 ? <TagRow tags={derived.libraryTags} theme={theme} /> : null}
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
