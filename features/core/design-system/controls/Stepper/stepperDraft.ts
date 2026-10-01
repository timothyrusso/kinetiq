/**
 * What a focused stepper field was typed to, and the value it was typed over.
 *
 * Nothing is written while the field is being typed in: the text is the field's own until it
 * commits. `base` is the value the typing started from, so that a change from anywhere else (a −
 * or + press) retires the draft: text typed over 15 is not what the field should show at 16.
 */
export type StepperDraft = { text: string; base: number };

export type FieldBounds = { min: number; max: number; decimal: boolean };

/** The locale's decimal separator: a comma in Italian, a point in English. */
export function decimalSeparator(locale: string): string {
  return (1.5).toLocaleString(locale).charAt(1) === ',' ? ',' : '.';
}

/**
 * The value as the field writes it: up to the two places a typed value keeps, with the locale's
 * separator, so a field opened on 62.25 does not reopen on 62.3 and commit that.
 */
export function fieldText(value: number, separator: string): string {
  return String(Math.round(value * 100) / 100).replace('.', separator);
}

/**
 * The keystroke as the field keeps it: digits, and one separator where decimals are allowed.
 * Either separator is taken whatever the locale, because Android's number pad offers both.
 */
export function typedText(typed: string, decimal: boolean): string {
  let kept = '';
  let separated = false;
  for (const char of typed) {
    if (char >= '0' && char <= '9') kept += char;
    else if (decimal && !separated && (char === '.' || char === ',')) {
      kept += char;
      separated = true;
    }
  }
  return kept;
}

/** The number typed, clamped to the range but not snapped to the step; nothing for no number. */
export function parseTyped(text: string, { min, max, decimal }: FieldBounds): number | null {
  if (!/\d/.test(text)) return null;
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const rounded = decimal ? Math.round(n * 100) / 100 : Math.round(n);
  return Math.min(max, Math.max(min, rounded));
}

/**
 * The value a draft commits, or nothing to write: no draft, a draft a press has retired, a field
 * left empty (the value stays), or a number equal to the value.
 */
export function committedValue(draft: StepperDraft | null, value: number, bounds: FieldBounds): number | null {
  if (draft === null || draft.base !== value) return null;
  const next = parseTyped(draft.text, bounds);
  return next === null || next === value ? null : next;
}

/** The field's text: the draft while it still describes the value, otherwise the value itself. */
export function stepperText(draft: StepperDraft | null, value: number, separator: string): string {
  return draft !== null && draft.base === value ? draft.text : fieldText(value, separator);
}
