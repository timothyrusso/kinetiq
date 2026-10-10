import { memo } from 'react';
import { Stepper } from '@/features/core/design-system/controls/Stepper';
import {
  SetStepperFrame,
  type SetStepperFrameProps,
  type StepperBounds,
  StepperLine,
} from '@/features/core/design-system/display/SetStepperRow/SetStepperFrame';
import {
  type SetStepperRowInput,
  useSetStepperRowLogic,
} from '@/features/core/design-system/display/SetStepperRow/SetStepperRow.logic';
import { useT } from '@/features/core/translations';

/**
 * One loaded set of an exercise being edited: its number, then reps, weight and RPE, each a
 * compact stepper on its own line with what it adjusts beside it. `RepsSetStepperRow` and
 * `DurationSetStepperRow` are its siblings for the other tracking types. The routine item sheet
 * and the live workout's exercise sheet both draw their sets with them; each owns how a change is
 * written. The rows are the few sets of one exercise in a form, not a scrolling list: each
 * stepper's native control is sized once and never recycled. Every value is a primitive and every
 * callback takes the index.
 */
export const SetStepperRow = memo(function SetStepperRow(
  props: SetStepperRowInput &
    SetStepperFrameProps & {
      reps: number;
      weight: number;
      repsBounds: StepperBounds;
      weightMax: number;
      weightStep: number;
    },
) {
  const { reps, weight, repsBounds, weightMax, weightStep, unit } = props;
  const { derived, effects } = useSetStepperRowLogic(props);
  const { t } = useT();

  return (
    <SetStepperFrame {...props} labels={derived.labels} onRpe={effects.changeRpe} onRemove={effects.remove}>
      <StepperLine label={t('itemEditor.reps')}>
        <Stepper
          label={derived.labels.reps}
          value={reps}
          min={repsBounds.min}
          max={repsBounds.max}
          step={1}
          compact
          onChange={effects.changeReps}
        />
      </StepperLine>
      <StepperLine label={t('itemEditor.weightIn', { unit })}>
        <Stepper
          label={derived.labels.weight}
          value={weight}
          min={0}
          max={weightMax}
          step={weightStep}
          decimal
          compact
          onChange={effects.changeWeight}
        />
      </StepperLine>
    </SetStepperFrame>
  );
});
