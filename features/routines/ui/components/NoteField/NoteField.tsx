import { TextInput } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useNoteFieldLogic } from '@/features/routines/ui/components/NoteField/NoteField.logic';

/**
 * The exercise's note, the cue shown on it mid-workout. Unlike the steppers it does not write on
 * every change: a saved routine's write refreshes the screen, and a refresh mid-word would move
 * the caret.
 */
export function NoteField({ note, onCommit }: { note: string | null; onCommit: (notes: string | null) => void }) {
  const { state, derived, effects } = useNoteFieldLogic(note, onCommit);
  const { t } = useT();
  return (
    <TextInput
      label={t('itemEditor.note')}
      value={state.text}
      onChangeText={effects.change}
      placeholder={t('itemEditor.notePlaceholder')}
      hint={derived.hint}
      multiline
      maxLength={derived.maxLength}
      autoCapitalize="sentences"
    />
  );
}
