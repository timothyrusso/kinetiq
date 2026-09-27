import { useCallback, useEffect, useRef, useState } from 'react';

import { TextInput } from '@/ui/controls/TextInput';
import { ITEM_BOUNDS } from '@/transfer/format';
import { useT } from '@/i18n/useT';

/** The longest cue that still reads as one line on a row and a caption on the workout card. */
const NOTE_MAX = ITEM_BOUNDS.notesLength;
/** The counter appears here, so it is a warning near the limit rather than noise throughout. */
const NOTE_COUNT_FROM = 160;
const NOTE_SAVE_DELAY_MS = 500;

/**
 * The exercise's note, which is the cue shown on it mid-workout.
 *
 * Unlike the steppers it does not write on every change: a saved routine's write is a database
 * update plus a cache refresh, and a refresh landing mid-word would move the caret. The field
 * keeps its own text and commits it once typing pauses, and again when the sheet closes, so
 * nothing typed is lost to a swipe. Empty or whitespace-only is stored as no note.
 */
export function NoteField({ note, onCommit }: { note: string | null; onCommit: (notes: string | null) => void }) {
  const { t } = useT();
  const [text, setText] = useState(note ?? '');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const flush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current === null) return;
    const trimmed = pending.current.trim();
    pending.current = null;
    commitRef.current(trimmed.length > 0 ? trimmed : null);
  }, []);
  useEffect(() => flush, [flush]);

  const change = useCallback(
    (next: string) => {
      setText(next);
      pending.current = next;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, NOTE_SAVE_DELAY_MS);
    },
    [flush],
  );

  return (
    <TextInput
      label={t('itemEditor.note')}
      value={text}
      onChangeText={change}
      placeholder={t('itemEditor.notePlaceholder')}
      hint={
        text.length >= NOTE_COUNT_FROM
          ? t('itemEditor.noteCount', { count: text.length, max: NOTE_MAX })
          : t('itemEditor.noteHint')
      }
      multiline
      maxLength={NOTE_MAX}
      autoCapitalize="sentences"
    />
  );
}

/* ------------------------------------------------------------------ helpers -- */
