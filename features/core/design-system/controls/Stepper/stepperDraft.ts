import { formatStepperValue } from '@/features/core/design-system/controls/Stepper/types';

/**
 * What a focused stepper field was typed to, and the value that typing left the stepper at.
 *
 * The draft carries its value so that a change from anywhere else (a − or + press while the field
 * is still focused) retires it: text typed for 15 is not what the field should show at 16.
 */
export type StepperDraft = { text: string; value: number };

type Bounds = { min: number; max: number; decimal: boolean };

function parse(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
}

/** The draft a keystroke leaves, with the value it commits: clamped, not snapped to the step. */
export function typedDraft(typed: string, value: number, { min, max, decimal }: Bounds): StepperDraft {
  const n = parse(typed);
  if (n === null) return { text: typed, value };
  const kept = Math.min(max, Math.max(min, decimal ? Math.round(n * 100) / 100 : Math.round(n)));
  return { text: typed, value: kept };
}

/** The field's text: the draft while it still describes the value, otherwise the value itself. */
export function stepperText(draft: StepperDraft | null, value: number): string {
  return draft !== null && draft.value === value ? draft.text : formatStepperValue(value);
}
