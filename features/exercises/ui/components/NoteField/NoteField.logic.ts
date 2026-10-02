import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/features/core/translations';
import { ITEM_BOUNDS } from '@/features/watch-bridge';

/** The longest cue that still reads as one line on a row and a caption on the workout card. */
const NOTE_MAX = ITEM_BOUNDS.notesLength;
/** The counter appears from here: a warning near the limit rather than noise throughout. */
const NOTE_COUNT_FROM = 160;
const NOTE_SAVE_DELAY_MS = 500;

/**
 * The note's own text, committed once typing pauses and again when the field goes away, so a
 * refresh landing mid-word never moves the caret and nothing typed is lost to a swipe. A blank
 * note is committed as no note.
 */
export function useNoteFieldLogic(note: string | null, onCommit: (notes: string | null) => void) {
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

  const hint =
    text.length >= NOTE_COUNT_FROM
      ? t('itemEditor.noteCount', { count: text.length, max: NOTE_MAX })
      : t('itemEditor.noteHint');

  return { state: { text }, derived: { hint, maxLength: NOTE_MAX }, effects: { change } };
}
