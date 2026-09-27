import { FormSheet } from '@/features/core/design-system';
import { ItemEditorForm } from '@/features/routines/ui/components/ItemEditorForm/ItemEditorForm';
import { useRoutineItemPageLogic } from '@/features/routines/ui/pages/RoutineItemPage/RoutineItemPage.logic';

/**
 * One routine item's targets (sets, reps, weight, rest), as a form sheet. Steppers write on every
 * press, so Done closes it and there is nothing to cancel.
 */
export function RoutineItemPage() {
  const { state, derived, effects } = useRoutineItemPageLogic();
  return (
    <FormSheet title={derived.title} scroll>
      {state.item ? (
        <ItemEditorForm
          item={state.item}
          snapshot={state.snapshot}
          units={state.units}
          onChange={effects.change}
          onRemove={effects.remove}
        />
      ) : null}
    </FormSheet>
  );
}
