import { Button, FormFooter, FormSection, MetaLine, Stepper, Txt, useStyles } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { type UnitSystem, weightUnit } from '@/features/core/utils';
import type { StrengthEntry, StrengthSet } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import type { SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';
import { useSetEditorFormLogic } from '@/features/workouts/ui/components/SetEditorForm/SetEditorForm.logic';
import { createStyles } from '@/features/workouts/ui/components/SetEditorForm/SetEditorForm.style';

/**
 * Editing one set: three steppers, no text field and no OK button. Each press writes through, so
 * closing the sheet is committing, which is why the only control besides them removes the set. A
 * text field would need a Done key and a rule for what "62." means when the sheet closes; RPE is a
 * stepper rather than a slider because a slider's hit region loses to a callus at arm's length.
 * The note about zero sits under each control, where it stays a note rather than a long heading.
 */
export function SetEditorForm({
  entry,
  set,
  units,
  onChange,
  onRemove,
}: {
  entry: StrengthEntry;
  set: StrengthSet;
  units: UnitSystem;
  onChange: (patch: SetPatch) => void;
  onRemove: () => void;
}) {
  const { derived, effects } = useSetEditorFormLogic(entry, set, units, onChange);
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  return (
    <>
      <MetaLine items={derived.context} theme={theme} wrap />
      <FormSection title={t('setRow.reps')}>
        <Stepper label={t('setRow.reps')} value={set.reps} min={0} max={100} step={1} onChange={effects.changeReps} />
      </FormSection>

      <FormSection title={t('setRow.weightIn', { unit: weightUnit(units) })}>
        <Stepper
          label={t('setRow.weightInUnit', { unit: weightUnit(units) })}
          value={derived.displayWeight}
          min={0}
          max={derived.maxWeight}
          step={derived.step}
          decimal
          onChange={effects.changeWeight}
        />
        {set.weightKg === 0 ? (
          <Txt variant="micro" tone="faint" style={styles.note}>
            {t('setRow.bodyweightNote')}
          </Txt>
        ) : null}
      </FormSection>

      <FormSection title={t('setRow.rpe')}>
        <Stepper label={t('setRow.rpe')} value={derived.rpe} min={0} max={10} step={1} onChange={effects.changeRpe} />
        <Txt variant="micro" tone="faint" style={styles.note}>
          {t('setRow.rpeNote')}
        </Txt>
      </FormSection>

      <FormFooter>
        <Button label={t('setRow.removeThisSet')} variant="danger" icon="trash" onPress={onRemove} />
      </FormFooter>
    </>
  );
}
