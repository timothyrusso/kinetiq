import { aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { derivedRoutineName, freeRoutineName, sameRoutineName } from '@/features/routines/domain/utils/routineNames';

describe('sameRoutineName', () => {
  it('treats names that differ only in case and surrounding spaces as the same', () => {
    expect(sameRoutineName(' Push Day ', 'push day')).toBe(true);
  });

  it('tells different names apart', () => {
    expect(sameRoutineName('Push Day', 'Push Day B')).toBe(false);
  });
});

describe('freeRoutineName', () => {
  it('keeps a name nobody has', () => {
    expect(freeRoutineName('Legs', ['Push Day'])).toBe('Legs');
  });

  it('adds the first free number to a taken name', () => {
    expect(freeRoutineName('Legs', ['legs', 'Legs 2'])).toBe('Legs 3');
  });
});

describe('derivedRoutineName', () => {
  it('names a one-exercise routine after its exercise', () => {
    expect(derivedRoutineName([aRoutineItem()])).toBe('Bench Press');
  });

  it('counts the exercises after the first', () => {
    expect(derivedRoutineName([aRoutineItem(), aRoutineItem(), aRoutineItem()])).toBe('Bench Press + 2 more');
  });

  it('falls back to New routine with no exercises', () => {
    expect(derivedRoutineName([])).toBe('New routine');
  });
});
