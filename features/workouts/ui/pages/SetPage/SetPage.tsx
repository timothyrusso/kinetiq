import { FormSheet } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { SetEditorForm } from '@/features/workouts/ui/components/SetEditorForm/SetEditorForm';
import { useSetPageLogic } from '@/features/workouts/ui/pages/SetPage/SetPage.logic';

/**
 * One set of the live workout, as a form sheet. Closing is committing, so the only header action
 * is Done; the destructive Remove sits in the content, where it cannot be mistaken for it.
 */
export function SetPage() {
  const { state, effects } = useSetPageLogic();
  const { t } = useT();
  return (
    <FormSheet title={t('setRow.thisSet')}>
      {state.entry && state.set ? (
        <SetEditorForm
          entry={state.entry}
          set={state.set}
          units={state.units}
          onChange={effects.change}
          onRemove={effects.remove}
        />
      ) : null}
    </FormSheet>
  );
}
