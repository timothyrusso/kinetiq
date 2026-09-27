import {
  addDays,
  compactNumber,
  formatCalories,
  formatDuration,
  formatDurationCompact,
  formatTimer,
  formatWeight,
  joinMiddleDot,
  parseNumber,
  repsFromRange,
  splitMetric,
  startOfDay,
  startOfWeek,
  trimNumber,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
  weightValue,
} from '@/features/core/utils';

describe('trimNumber', () => {
  it('drops trailing zeros', () => {
    expect([trimNumber(5), trimNumber(5.4), trimNumber(5.42)]).toEqual(['5', '5.4', '5.42']);
  });

  it('shows a dash for a value that is not finite', () => {
    expect(trimNumber(Number.NaN)).toBe('-');
  });
});

describe('compactNumber', () => {
  it('groups thousands below ten thousand', () => {
    expect(compactNumber(1234)).toBe('1,234');
  });

  it('abbreviates tens of thousands with k', () => {
    expect(compactNumber(12_345)).toBe('12.3k');
  });

  it('abbreviates millions with M', () => {
    expect(compactNumber(1_234_567)).toBe('1.2M');
  });

  it('shows a dash for a value that is not finite', () => {
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe('-');
  });
});

describe('formatDuration', () => {
  it('shows hours, minutes and seconds past an hour', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('shows minutes and seconds under an hour', () => {
    expect(formatDuration(2920)).toBe('48:40');
  });

  it('uses the prime separator when asked', () => {
    expect([formatDuration(2920, "'"), formatDuration(3661, "'")]).toEqual(["48'40", "1:01'"]);
  });

  it('reads a negative duration as zero', () => {
    expect(formatDuration(-5)).toBe('00:00');
  });
});

describe('formatDurationCompact', () => {
  it('shows hours and minutes', () => {
    expect(formatDurationCompact(3661)).toBe('1h 1m');
  });

  it('shows whole hours alone', () => {
    expect(formatDurationCompact(7200)).toBe('2h');
  });

  it('shows minutes alone under an hour', () => {
    expect(formatDurationCompact(2920)).toBe('49m');
  });

  it('shows seconds under a minute', () => {
    expect(formatDurationCompact(20)).toBe('20s');
  });
});

describe('formatTimer', () => {
  it('rounds up to the next whole second', () => {
    expect(formatTimer(94.2)).toBe('1:35');
  });
});

describe('weights', () => {
  it('keeps kilograms in metric and converts to pounds in imperial', () => {
    expect([weightValue(100, 'metric'), Math.round(weightValue(100, 'imperial'))]).toEqual([100, 220]);
  });

  it('names the unit of each system', () => {
    expect([weightUnit('metric'), weightUnit('imperial')]).toEqual(['kg', 'lb']);
  });

  it('formats kilograms to one place and pounds whole', () => {
    expect([formatWeight(82.5, 'metric'), formatWeight(82.5, 'imperial')]).toEqual(['82.5 kg', '182 lb']);
  });

  it('formats no weight as zero in the system unit', () => {
    expect([formatWeight(0, 'metric'), formatWeight(-1, 'imperial')]).toEqual(['0 kg', '0 lb']);
  });

  it('shows metric kilograms as they are', () => {
    expect(weightDisplayValue(60, 'metric', 1)).toBe(60);
  });

  it('rounds a pound value to the tenth for a fractional step and to the unit otherwise', () => {
    expect([weightDisplayValue(60, 'imperial', 0.5), weightDisplayValue(60, 'imperial', 2.5)]).toEqual([132.3, 132]);
  });

  it('reads a typed pound value back as kilograms to two places', () => {
    expect(weightFromDisplayValue(135, 'imperial')).toBe(61.23);
  });

  it('steps by the plates people own', () => {
    expect([weightStep('metric'), weightStep('imperial')]).toEqual([1, 2.5]);
  });
});

describe('repsFromRange', () => {
  it('takes the leading number of a range', () => {
    expect(repsFromRange('5-8')).toBe(5);
  });

  it('reads a target with no number as eight', () => {
    expect(repsFromRange('AMRAP')).toBe(8);
  });

  it('reads a number above one hundred as eight', () => {
    expect(repsFromRange('1000')).toBe(8);
  });
});

describe('formatCalories', () => {
  it('rounds to a whole number', () => {
    expect(formatCalories(278.6)).toBe('279');
  });

  it('shows zero for nothing burned', () => {
    expect(formatCalories(0)).toBe('0');
  });
});

describe('dates', () => {
  const WEDNESDAY_NOON = new Date(2026, 8, 23, 12, 30);

  it('takes a day back to its local midnight', () => {
    expect(startOfDay(WEDNESDAY_NOON)).toEqual(new Date(2026, 8, 23));
  });

  it('adds days in local time', () => {
    expect(addDays(new Date(2026, 8, 23), 9)).toEqual(new Date(2026, 9, 2));
  });

  it('starts a week on the Monday', () => {
    expect(startOfWeek(WEDNESDAY_NOON)).toEqual(new Date(2026, 8, 21));
  });

  it('puts a Sunday in the week that began the Monday before', () => {
    expect(startOfWeek(new Date(2026, 8, 27, 9))).toEqual(new Date(2026, 8, 21));
  });
});

describe('parseNumber', () => {
  it('reads a decimal comma as a point', () => {
    expect(parseNumber(' 82,5 ')).toBe(82.5);
  });

  it('rejects an empty field', () => {
    expect(parseNumber('   ')).toBeNull();
  });

  it('rejects text that is not a number', () => {
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('joinMiddleDot', () => {
  it('joins the non-empty parts with a middle dot', () => {
    expect(joinMiddleDot(['Bench Press', '', null, ' ', 'Chest'])).toBe('Bench Press  ·  Chest');
  });
});

describe('splitMetric', () => {
  it('splits a trailing unit from the value', () => {
    expect(splitMetric('82.5 kg')).toEqual({ value: '82.5', unit: 'kg' });
  });

  it('keeps text whose last word is not a unit whole', () => {
    expect(splitMetric('12:45')).toEqual({ value: '12:45' });
  });
});
