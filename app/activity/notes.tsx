/**
 * An activity's notes, as a form sheet.
 *
 * Save closes only on success. The draft lives in this sheet's state, so closing on failure
 * would lose the typed paragraph while the note it describes stayed unwritten; instead the
 * field keeps its text and the reason appears under it.
 */
import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useT } from '@/i18n/useT';
import { useActivity, useUpdateActivityNotes } from '@/queries/useActivities';
import { FormSheet, closeSheet } from '@/ui/FormSheet';
import { TextField } from '@/ui/TextField';

export default function ActivityNotesSheet() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useActivity(id);
  const saveNotes = useUpdateActivityNotes();
  const [draft, setDraft] = useState(query.data?.notes ?? '');

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    // An emptied field clears the note rather than storing "": `notes` is `string | null`.
    saveNotes.mutate({ id, notes: trimmed.length === 0 ? null : trimmed }, { onSuccess: closeSheet });
  }, [draft, id, saveNotes]);

  return (
    <FormSheet
      title={t('activity.notesTitle')}
      doneLabel="common.save"
      onDone={commit}
      doneDisabled={saveNotes.isPending}
    >
      <TextField
        label={t('activity.notesLabel')}
        value={draft}
        onChangeText={(text) => {
          // Typing again is a second attempt, so the previous failure stops being true.
          if (saveNotes.isError) saveNotes.reset();
          setDraft(text);
        }}
        multiline
        autoFocus
        placeholder={t('activity.notesPlaceholder')}
        hint={t('activity.notesHint')}
        {...(saveNotes.isError
          ? {
              error:
                saveNotes.error instanceof Error ? saveNotes.error.message : t('activity.notesSaveFailed'),
            }
          : {})}
      />
    </FormSheet>
  );
}
