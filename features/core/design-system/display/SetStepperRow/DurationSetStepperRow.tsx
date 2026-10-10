import { memo } from 'react';
import { Stepper } from '@/features/core/design-system/controls/Stepper';
import {
  type DurationSetStepperRowInput,
  useDurationSetStepperRowLogic,
} from '@/features/core/design-system/display/SetStepperRow/DurationSetStepperRow.logic';
import {
  SetStepperFrame,
  type SetStepperFrameProps,
  type StepperBounds,
  StepperLine,
} from '@/features/core/design-system/display/SetStepperRow/SetStepperFrame';
import { useT } from '@/features/core/translations';
import { formatTimer } from '@/features/core/utils';

/** A nudge of the time: five seconds, fine enough for a plank and quick enough for a long hold. */
const DURATION_STEP_SECONDS = 5;

/**
 * One timed set (a plank, a hold, a stretch): its number, its time and its RPE. The sibling of
 * `SetStepperRow`. The time steps in seconds and reads as `m:ss`; tapping it types seconds.
 */
export const DurationSetStepperRow = memo(function DurationSetStepperRow(
  props: DurationSetStepperRowInput & SetStepperFrameProps & { durationSeconds: number; durationBounds: StepperBounds },
) {
  const { durationSeconds, durationBounds } = props;
  const { derived, effects } = useDurationSetStepperRowLogic(props);
  const { t } = useT();

  return (
    <SetStepperFrame {...props} labels={derived.labels} onRpe={effects.changeRpe} onRemove={effects.remove}>
      <StepperLine label={t('tracking.time')}>
        <Stepper
          label={derived.labels.duration}
          value={durationSeconds}
          min={durationBounds.min}
          max={durationBounds.max}
          step={DURATION_STEP_SECONDS}
          format={formatTimer}
          compact
          onChange={effects.changeDuration}
        />
      </StepperLine>
    </SetStepperFrame>
  );
});
