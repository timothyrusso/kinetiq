/**
 * Renaming a saved routine, as a form sheet.
 *
 * The header's trailing action is "Save name": the label the CRUD gate presses, and the one
 * that says what happens. An empty name is refused inline, where the typing happened, rather
 * than by a disabled button that does not say why.
 */
import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useT } from '@/i18n/useT';
import { useRenameRoutine, useRoutine } from '@/queries/useRoutines';
import { haptics } from '@/services/haptics';
import { FormSheet, closeSheet } from '@/ui/FormSheet';
import { Txt } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

export default function RenameRoutineSheet() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routine } = useRoutine(id);
  const rename = useRenameRoutine();
  const [name, setName] = useState(routine?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const commit = useCallback(() => {
    if (trimmed.length === 0) {
      setError(t('routine.nameRequired'));
      haptics.warning();
      return;
    }
    setError(null);
    rename
      .mutateAsync({ id, name: trimmed })
      .then(() => {
        haptics.success();
        closeSheet();
      })
      .catch(() => {
        setError(t('routine.renameFailed'));
        haptics.warning();
      });
  }, [id, rename, t, trimmed]);

  return (
    <FormSheet
      title={t('routine.renameTitle')}
      doneLabel="routine.saveName"
      onDone={commit}
      doneDisabled={rename.isPending}
    >
      {/* What else the name does: the one consequence not visible from the field itself. */}
      <Txt variant="caption" tone="muted">
        {t('routine.renameHint')}
      </Txt>
      <TextField
        label={t('routine.nameLabel')}
        value={name}
        onChangeText={(next) => {
          setName(next);
          if (error !== null) setError(null);
        }}
        error={error}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={commit}
        accessibilityHint={t('routine.nameFieldHint')}
      />
    </FormSheet>
  );
}
