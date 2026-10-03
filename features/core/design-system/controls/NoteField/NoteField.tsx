import { useNoteFieldLogic } from '@/features/core/design-system/controls/NoteField/NoteField.logic';
import { TextInput } from '@/features/core/design-system/controls/TextInput';
import { useT } from '@/features/core/translations';

/**
 * The exercise's note, the cue shown on it mid-workout. Unlike the steppers it does not write on
 * every change: a saved routine's write refreshes the screen, and a refresh mid-word would move
 * the caret.
 */
export function NoteField({
  note,
  maxLength,
  onCommit,
}: {
  note: string | null;
  /** The longest note the caller stores. */
  maxLength: number;
  onCommit: (notes: string | null) => void;
}) {
  const { state, derived, effects } = useNoteFieldLogic(note, maxLength, onCommit);
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
