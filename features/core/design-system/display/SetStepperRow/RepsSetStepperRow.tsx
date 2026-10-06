import { memo } from 'react';
import { Stepper } from '@/features/core/design-system/controls/Stepper';
import {
  type RepsSetStepperRowInput,
  useRepsSetStepperRowLogic,
} from '@/features/core/design-system/display/SetStepperRow/RepsSetStepperRow.logic';
import {
  SetStepperFrame,
  type SetStepperFrameProps,
  type StepperBounds,
  StepperLine,
} from '@/features/core/design-system/display/SetStepperRow/SetStepperFrame';
import { useT } from '@/features/core/translations';

/**
 * One set counted in reps alone (a pull-up, a push-up): its number, its reps and its RPE. The
 * sibling of `SetStepperRow`, with no weight line: the exercise records none.
 */
export const RepsSetStepperRow = memo(function RepsSetStepperRow(
  props: RepsSetStepperRowInput & SetStepperFrameProps & { reps: number; repsBounds: StepperBounds },
) {
  const { reps, repsBounds } = props;
  const { derived, effects } = useRepsSetStepperRowLogic(props);
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
    </SetStepperFrame>
  );
});
