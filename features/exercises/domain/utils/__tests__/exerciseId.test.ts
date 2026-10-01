import {
  isCatalogExerciseId,
  isLocalExerciseId,
  provisionalExerciseName,
} from '@/features/exercises/domain/utils/exerciseId';

describe('isCatalogExerciseId', () => {
  it('accepts an ex: slug', () => {
    expect(isCatalogExerciseId('ex:barbell-bench-press')).toBe(true);
    expect(isCatalogExerciseId('ex:3-4-sit-up')).toBe(true);
  });

  it('rejects a local id, an id from the previous catalog and a malformed slug', () => {
    expect(isCatalogExerciseId('local:bench-press')).toBe(false);
    expect(isCatalogExerciseId('legacy:73')).toBe(false);
    expect(isCatalogExerciseId('ex:')).toBe(false);
    expect(isCatalogExerciseId('ex:Bench Press')).toBe(false);
  });
});

describe('isLocalExerciseId', () => {
  it('tells a local id from a catalog one', () => {
    expect(isLocalExerciseId('local:bench-press')).toBe(true);
    expect(isLocalExerciseId('ex:bench-press')).toBe(false);
  });
});

describe('provisionalExerciseName', () => {
  it('names a catalog id by its slug, as the catalog does', () => {
    expect(provisionalExerciseName('ex:barbell-bench-press')).toBe('Barbell Bench Press');
  });

  it('title-cases a local key', () => {
    expect(provisionalExerciseName('local:romanian_deadlift')).toBe('Romanian Deadlift');
  });

  it('falls back to a plain title for an empty key or an unknown id', () => {
    expect(provisionalExerciseName('local:')).toBe('Exercise');
    expect(provisionalExerciseName('legacy:1234')).toBe('Exercise');
    expect(provisionalExerciseName('mystery')).toBe('Exercise');
  });
});
