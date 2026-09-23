/**
 * A number adjusted in fixed steps: sets, reps, a weight, a rest.
 *
 * Steppers here write through on every press, so they are a surface for adjusting, not a form
 * field to submit. `label` is what is being adjusted, for the controls' spoken labels.
 */
export type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  label: string;
  /** The smaller size used inside a list row or a set editor line. */
  compact?: boolean;
};

export function formatStepperValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Round to the step and clamp to the range, keeping fractional steps (2.5 kg) exact. */
export function stepClamp(n: number, { min = 0, max = 999, step = 1 }: Pick<StepperProps, 'min' | 'max' | 'step'>): number {
  const stepped = Math.round(n / step) * step;
  const decimals = step < 1 || !Number.isInteger(step) ? 2 : 0;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(decimals))));
}
