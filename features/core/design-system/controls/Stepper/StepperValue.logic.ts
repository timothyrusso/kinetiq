import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type EmitterSubscription, Keyboard, type TextInput } from 'react-native';
import {
  committedValue,
  decimalSeparator,
  type FieldBounds,
  fieldText,
  type StepperDraft,
  stepperText,
  typedText,
} from '@/features/core/design-system/controls/Stepper/stepperDraft';
import { useT } from '@/features/core/translations';

/**
 * The typed half of a stepper: the field keeps its own text while focused and commits once, on
 * blur, the keyboard's done key, or the field going away.
 *
 * Writing on every keystroke is what broke typing on Android: the field showed the typed text
 * only while the value that came back matched it, and the value comes back late (a saved routine
 * writes, then refetches) or changed (a pound weight is rounded to its step). For the moment the
 * two differed the field snapped to the old number, and the next key landed on that: digits lost,
 * zeros that were never typed.
 *
 * `take` retires a pending draft and returns the number it would commit (nothing when there is none
 * to write), for a − or + press to step from the typed number rather than the one under it. The field
 * going away commits too: a sheet swiped shut mid-typing, or iOS's number pad, which has no done
 * key.
 */
export function useStepperField(value: number, onChange: (next: number) => void, bounds: FieldBounds) {
  const { locale } = useT();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const [draft, setDraft] = useState<StepperDraft | null>(null);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const keyboard = useRef<EmitterSubscription | null>(null);
  const latest = useRef({ draft, value, onChange, bounds });
  latest.current = { draft, value, onChange, bounds };

  const take = useCallback((): number | null => {
    const { draft: pending, value: current, bounds: range } = latest.current;
    latest.current.draft = null;
    setDraft(null);
    return committedValue(pending, current, range);
  }, []);
  const commit = useCallback((): number | null => {
    const next = take();
    if (next !== null) latest.current.onChange(next);
    return next;
  }, [take]);

  const focus = useCallback(() => {
    const current = latest.current.value;
    setDraft(kept =>
      kept !== null && kept.base === current ? kept : { text: fieldText(current, separator), base: current },
    );
    setFocused(true);
    // NOTE: Android's back key hides the keyboard but leaves the field focused, so nothing would commit.
    keyboard.current?.remove();
    keyboard.current = Keyboard.addListener('keyboardDidHide', () => input.current?.blur());
  }, [separator]);

  const changeText = useCallback((typed: string) => {
    const next = { text: typedText(typed, latest.current.bounds.decimal), base: latest.current.value };
    latest.current.draft = next;
    setDraft(next);
  }, []);

  const blur = useCallback(() => {
    keyboard.current?.remove();
    keyboard.current = null;
    setFocused(false);
    const before = latest.current.value;
    const next = commit();
    // NOTE: Until the write comes back the field keeps showing what it committed, not the old number.
    if (next !== null) setDraft({ text: fieldText(next, separator), base: before });
  }, [commit, separator]);

  useEffect(
    () => () => {
      keyboard.current?.remove();
      commit();
    },
    [commit],
  );

  return {
    // NOTE: Select-on-focus is switched off while focused. Android's field selects all again on its
    // first layout after focus, and a field that widens as it is typed in lays out mid-typing: the
    // third digit replaced the first two.
    state: { text: stepperText(draft, value, separator), input, selectOnFocus: !focused },
    effects: { focus, changeText, blur, take },
  };
}
