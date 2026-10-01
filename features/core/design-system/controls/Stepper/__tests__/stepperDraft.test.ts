import {
  committedValue,
  decimalSeparator,
  fieldText,
  parseTyped,
  stepperText,
  typedText,
} from '@/features/core/design-system/controls/Stepper/stepperDraft';

const reps = { min: 1, max: 100, decimal: false };
const kg = { min: 0, max: 500, decimal: true };

describe('typedText', () => {
  it('keeps what was typed, digit for digit', () => {
    expect(typedText('102.5', true)).toBe('102.5');
    expect(typedText('102,5', true)).toBe('102,5');
    expect(typedText('', true)).toBe('');
    expect(typedText('1.', true)).toBe('1.');
  });

  it('drops what a number cannot hold', () => {
    expect(typedText('-1 2', false)).toBe('12');
    expect(typedText('12.5', false)).toBe('125');
    expect(typedText('1.2.5', true)).toBe('1.25');
  });
});

describe('parseTyped', () => {
  it('reads a decimal comma as a point', () => {
    expect(parseTyped('102,5', kg)).toBe(102.5);
    expect(parseTyped('102.5', kg)).toBe(102.5);
  });

  it('clamps to the range without snapping to the step', () => {
    expect(parseTyped('150', reps)).toBe(100);
    expect(parseTyped('0', reps)).toBe(1);
    expect(parseTyped('7', reps)).toBe(7);
  });

  it('reads no number from an empty field or a lone separator', () => {
    expect(parseTyped('', kg)).toBeNull();
    expect(parseTyped(',', kg)).toBeNull();
  });
});

describe('committedValue', () => {
  it('commits what was typed over the value, clamped', () => {
    expect(committedValue({ text: '12', base: 8 }, 8, reps)).toBe(12);
    expect(committedValue({ text: '999', base: 8 }, 8, reps)).toBe(100);
  });

  it('keeps the value when the field was left empty', () => {
    expect(committedValue({ text: '', base: 8 }, 8, reps)).toBeNull();
  });

  it('writes nothing for a draft a press has retired', () => {
    expect(committedValue({ text: '12', base: 8 }, 9, reps)).toBeNull();
  });

  it('writes nothing when the number did not change', () => {
    expect(committedValue({ text: '62,50', base: 62.5 }, 62.5, kg)).toBeNull();
  });
});

describe('stepperText', () => {
  it('shows exactly what is typed while it still describes the value', () => {
    expect(stepperText({ text: '', base: 12 }, 12, '.')).toBe('');
    expect(stepperText({ text: '10', base: 60 }, 60, '.')).toBe('10');
  });

  it('shows the new value once a press moves it away from the draft', () => {
    expect(stepperText({ text: '15', base: 15 }, 16, '.')).toBe('16');
  });

  it('shows the value in the locale when nothing is being typed', () => {
    expect(stepperText(null, 2.5, '.')).toBe('2.5');
    expect(stepperText(null, 102.5, ',')).toBe('102,5');
  });
});

describe('fieldText', () => {
  it('keeps the two places a typed value can have', () => {
    expect(fieldText(62.25, '.')).toBe('62.25');
    expect(fieldText(60, ',')).toBe('60');
  });
});

describe('decimalSeparator', () => {
  it('is a comma in Italian and a point in English', () => {
    expect(decimalSeparator('it-IT')).toBe(',');
    expect(decimalSeparator('en-US')).toBe('.');
  });
});
