import { FormSheet } from '@/features/core/design-system';
import { ExerciseEditorForm } from '@/features/workouts/ui/components/ExerciseEditorForm/ExerciseEditorForm';
import { useSessionExercisePageLogic } from '@/features/workouts/ui/pages/SessionExercisePage/SessionExercisePage.logic';

/**
 * One exercise of the live workout, as a form sheet laid out like the routine item sheet.
 * Steppers write on every press, so Done closes it and there is nothing to cancel. Removing the
 * exercise stays on the session's block, behind its confirmation: here it would drop banked sets
 * one tap away from a stepper.
 */
export function SessionExercisePage() {
  const { state, derived, effects } = useSessionExercisePageLogic();
  return (
    <FormSheet title={derived.title} scroll {...(derived.scrollTo === undefined ? {} : { scrollTo: derived.scrollTo })}>
      {state.entry ? (
        <ExerciseEditorForm
          entry={state.entry}
          units={state.units}
          tags={derived.tags}
          about={derived.about}
          onOpenExercise={effects.openExercise}
          highlightedSet={state.highlightedSet}
          highlightRef={derived.highlightRef}
          onChangeSet={effects.changeSet}
          onAddSet={effects.addSet}
          onRemoveSet={effects.removeSet}
          onChangeEntry={effects.changeEntry}
          onChangeType={effects.changeType}
        />
      ) : null}
    </FormSheet>
  );
}
