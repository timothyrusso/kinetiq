import { FormSheet, TextInput, Txt } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useRenameRoutinePageLogic } from '@/features/routines/ui/pages/RenameRoutinePage/RenameRoutinePage.logic';

/**
 * Renaming a saved routine, as a form sheet. The trailing action says what happens: Save name.
 */
export function RenameRoutinePage() {
  const { state, derived, effects } = useRenameRoutinePageLogic();
  const { t } = useT();

  return (
    <FormSheet
      title={t('routine.renameTitle')}
      doneLabel="routine.saveName"
      onDone={effects.commit}
      doneDisabled={state.saving}
    >
      <Txt variant="caption" tone="muted">
        {t('routine.renameHint')}
      </Txt>
      <TextInput
        label={t('routine.nameLabel')}
        value={state.name}
        onChangeText={effects.change}
        error={derived.error}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={effects.commit}
        accessibilityHint={t('routine.nameFieldHint')}
      />
    </FormSheet>
  );
}
