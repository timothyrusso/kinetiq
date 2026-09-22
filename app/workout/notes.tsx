/**
 * Session notes, as a form sheet over the live workout.
 *
 * The notes are the one place in a workout that is prose, so they open in a sheet rather than
 * sitting inline: the keyboard can never be up over the set list while someone scrolls past.
 * Saving writes straight into the session engine, which persists before it publishes.
 */
import { useCallback, useState } from 'react';

import { useT } from '@/i18n/useT';
import { FormSheet, closeSheet } from '@/ui/FormSheet';
import { TextInput } from '@/ui/controls/TextInput';
import { setSessionNotes, useWorkoutSession } from '@/workout/session';

export default function SessionNotesSheet() {
  const { t } = useT();
  const { session } = useWorkoutSession();
  const [draft, setDraft] = useState(session?.notes ?? '');

  const save = useCallback(() => {
    const trimmed = draft.trim();
    setSessionNotes(trimmed.length > 0 ? trimmed : null);
    closeSheet();
  }, [draft]);

  return (
    <FormSheet title={t('session.notesTitle')} doneLabel="common.save" onDone={save}>
      <TextInput
        label={t('session.notesLabel')}
        value={draft}
        onChangeText={setDraft}
        multiline
        autoFocus
        placeholder={t('session.notesPlaceholder')}
        hint={t('session.notesHint')}
      />
    </FormSheet>
  );
}
