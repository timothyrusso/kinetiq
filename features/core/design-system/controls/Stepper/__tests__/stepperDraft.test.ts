import { stepperText, typedDraft } from '@/features/core/design-system/controls/Stepper/stepperDraft';

const reps = { min: 1, max: 100, decimal: false };

describe('typedDraft', () => {
  it('commits a typed number clamped to the range', () => {
    expect(typedDraft('150', 12, reps)).toEqual({ text: '150', value: 100 });
  });

  it('keeps the value while the field is cleared to type another', () => {
    expect(typedDraft('', 12, reps)).toEqual({ text: '', value: 12 });
  });

  it('reads a decimal comma as a point', () => {
    expect(typedDraft('62,5', 60, { min: 0, max: 500, decimal: true })).toEqual({ text: '62,5', value: 62.5 });
  });
});

describe('stepperText', () => {
  it('shows what was typed while it still describes the value', () => {
    expect(stepperText({ text: '', value: 12 }, 12)).toBe('');
  });

  it('shows the new value once a press moves it away from the draft', () => {
    expect(stepperText({ text: '15', value: 15 }, 16)).toBe('16');
  });

  it('shows the value when nothing is being typed', () => {
    expect(stepperText(null, 2.5)).toBe('2.5');
  });
});
