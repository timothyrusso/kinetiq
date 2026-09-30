import { FormSheet, Switch, Txt } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useFinishPageLogic } from '@/features/workouts/ui/pages/FinishPage/FinishPage.logic';

/**
 * Finishing the workout in progress, as a form sheet rather than an alert: an alert cannot hold
 * a switch on either platform. The trailing action says what happens (Finish and save); a swipe
 * down keeps training. The routine switch is there only for a workout from a routine.
 */
export function FinishPage() {
  const { state, derived, effects } = useFinishPageLogic();
  const { t } = useT();
  return (
    <FormSheet
      title={t('session.finishTitle')}
      doneLabel="session.finishConfirm"
      onDone={effects.finish}
      doneDisabled={state.session === null || state.finishing}
    >
      <Txt variant="caption" tone="muted">
        {derived.message}
      </Txt>
      {derived.showRoutineSwitch ? (
        <>
          <Switch
            label={t('session.finishUpdateRoutine')}
            value={state.updateRoutine}
            onChange={effects.setUpdateRoutine}
            disabled={state.finishing}
          />
          <Txt variant="caption" tone="faint">
            {t('session.finishUpdateRoutineHint')}
          </Txt>
        </>
      ) : null}
      {state.error !== null ? (
        <Txt variant="caption" tone="danger">
          {state.error}
        </Txt>
      ) : null}
    </FormSheet>
  );
}
