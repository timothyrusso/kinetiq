import { useMemo } from 'react';

import type { StrengthEntry, StrengthSet } from '@/domain/types';
import type { UnitSystem } from '@/utils/format';
import { spacing } from '@/theme/tokens';
import { weightDisplayValue, weightFromDisplayValue, weightStep, weightUnit } from '@/utils/format';
import { Button } from '@/ui/controls/Button';
import { Stepper } from '@/ui/controls/Stepper';
import { Txt } from '@/ui/Text';
import { FormFooter, FormSection } from '@/ui/FormSheet';
import { useT } from '@/i18n/useT';
import { useAppTheme } from '@/theme/theme';
import { MetaLine, type MetaItem } from '@/ui/display';

/**
 * Editing one set: three steppers, no text fields, and no OK button.
 *
 * `Stepper` writes through on every press, so the sheet is a surface for adjusting, not a
 * form to submit: closing it *is* committing, which is why the only footer control says
 * Done and never Cancel. A text field here would need a Done key, a blur, and a rule for
 * what "62." means when the sheet closes mid-keystroke; three steppers need none of that.
 *
 * RPE uses a stepper rather than a slider because a slider's hit region loses to a callus
 * at arm's length. RPE 0 means "not recorded", which is the default for most sets.
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
  onChange: (patch: { reps?: number; weightKg?: number; rpe?: number | null }) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const step = weightStep(units);
  const displayWeight = weightDisplayValue(set.weightKg, units, step);
  const context = useMemo<MetaItem[]>(
    () => [
      { icon: 'dumbbell', label: entry.exerciseName },
      { icon: 'layers', label: t('workoutFlow.repCount', { count: set.reps }) },
    ],
    [entry.exerciseName, set.reps, t],
  );

  return (
    <>
      <MetaLine items={context} theme={theme} wrap />
      <FormSection title={t('setRow.reps')}>
        <Stepper
          label={t('setRow.reps')}
          value={set.reps}
          min={0}
          max={100}
          step={1}
          onChange={(reps) => {
            onChange({ reps });
          }}
        />
      </FormSection>

      <FormSection title={t('setRow.weightIn', { unit: weightUnit(units) })}>
        <Stepper
          label={t('setRow.weightInUnit', { unit: weightUnit(units) })}
          value={displayWeight}
          min={0}
          max={units === 'imperial' ? 1000 : 450}
          step={step}
          decimal
          onChange={(next) => {
            // Converted on the way out only. Landing on 0 is a deliberate
            // "bodyweight": the engine stores 0 and the row renders it as BW.
            onChange({ weightKg: weightFromDisplayValue(next, units) });
          }}
        />
        {set.weightKg === 0 ? (
          <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
            {t('setRow.bodyweightNote')}
          </Txt>
        ) : null}
      </FormSection>

      <FormSection title={t('setRow.rpe')}>
        <Stepper
          label={t('setRow.rpe')}
          value={set.rpe ?? 0}
          min={0}
          max={10}
          step={1}
          onChange={(rpe) => {
            onChange({ rpe: rpe === 0 ? null : rpe });
          }}
        />
        {/* The qualification about zero goes under the control, in the same place the
            weight section explains bodyweight. As part of the section title it became a
            twelve-word eyebrow, which stops being a heading at that length. */}
        <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
          {t('setRow.rpeNote')}
        </Txt>
      </FormSection>

      <FormFooter>
        <Button
          label={t('setRow.removeThisSet')}
          variant="danger"
          icon="trash"
          onPress={onRemove}
        />
      </FormFooter>
    </>
  );
}
