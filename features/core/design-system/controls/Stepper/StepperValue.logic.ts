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
 * to write), for a − or + press to step from the typed number rather than the one under it; the
 * press writes through `write`. The field going away commits too: a sheet swiped shut mid-typing,
 * or iOS's number pad, which has no done key.
 *
 * ## The number in flight
 *
 * A write can take a moment to come back as `value`. Until it does, the field stands for the
 * number it wrote (`state.value`): a draft started in that moment is typed over that number, so the
 * write landing does not retire it, and a draft that only repeats it writes nothing again.
 *
 * The number is held only while `value` is still the one it was written over. Whatever `value`
 * moves to next is what the write came back as, and it wins even when it differs: a pound weight
 * rounded to its step (102.5 lb comes back as 102), or a failed write rolled back.
 *
 * `format` draws the value at rest in another form (a time as `m:ss`); focusing the field opens
 * the plain number for typing.
 */
export function useStepperField(
  value: number,
  onChange: (next: number) => void,
  bounds: FieldBounds,
  format?: (value: number) => string,
) {
  const { locale } = useT();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const [draft, setDraft] = useState<StepperDraft | null>(null);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const keyboard = useRef<EmitterSubscription | null>(null);
  const [inFlight, setInFlight] = useState<{ next: number; over: number } | null>(null);
  const shown = inFlight !== null && inFlight.over === value ? inFlight.next : value;
  const latest = useRef({ draft, value: shown, prop: value, onChange, bounds });
  latest.current = { draft, value: shown, prop: value, onChange, bounds };

  useEffect(() => {
    setInFlight(held => (held !== null && held.over !== value ? null : held));
  }, [value]);

  const write = useCallback((next: number) => {
    setInFlight({ next, over: latest.current.prop });
    latest.current.value = next;
    latest.current.onChange(next);
  }, []);

  const take = useCallback((): number | null => {
    const { draft: pending, value: current, bounds: range } = latest.current;
    latest.current.draft = null;
    setDraft(null);
    return committedValue(pending, current, range);
  }, []);

  const commit = useCallback(() => {
    const next = take();
    if (next !== null) write(next);
  }, [take, write]);

  const focus = useCallback(() => {
    const current = latest.current.value;
    const next = { text: fieldText(current, separator), base: current };
    latest.current.draft = next;
    setDraft(next);
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
    commit();
  }, [commit]);

  useEffect(
    () => () => {
      keyboard.current?.remove();
      commit();
    },
    [commit],
  );

  return {
    state: {
      value: shown,
      text: stepperText(draft, shown, separator, format),
      input,
      // NOTE: Select-on-focus is switched off while focused. Android's field selects all again on its
      // first layout after focus, and a field that widens as it is typed in lays out mid-typing: the
      // third digit replaced the first two.
      selectOnFocus: !focused,
    },
    effects: { focus, changeText, blur, take, write },
  };
}
