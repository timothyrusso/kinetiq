import {
  externalIdOf,
  isLocalExerciseId,
  provisionalExerciseName,
  remoteExerciseId,
} from '@/features/exercises/domain/utils/exerciseId';

describe('remoteExerciseId', () => {
  it('names a wger id in the app namespace', () => {
    expect(remoteExerciseId(46)).toBe('wger:46');
  });
});

describe('externalIdOf', () => {
  it('reads the wger id back', () => {
    expect(externalIdOf('wger:46')).toBe(46);
  });

  it('is null for a local id, a malformed id and a non-positive id', () => {
    expect(externalIdOf('local:bench-press')).toBeNull();
    expect(externalIdOf('wger:abc')).toBeNull();
    expect(externalIdOf('wger:0')).toBeNull();
  });
});

describe('isLocalExerciseId', () => {
  it('tells a local id from a catalog one', () => {
    expect(isLocalExerciseId('local:bench-press')).toBe(true);
    expect(isLocalExerciseId('wger:46')).toBe(false);
  });
});

describe('provisionalExerciseName', () => {
  it('names a catalog id by its number, as the catalog does', () => {
    expect(provisionalExerciseName('wger:1234')).toBe('Exercise 1234');
  });

  it('title-cases a local key', () => {
    expect(provisionalExerciseName('local:romanian_deadlift')).toBe('Romanian Deadlift');
  });

  it('falls back to a plain title for an empty key or an unknown id', () => {
    expect(provisionalExerciseName('local:')).toBe('Exercise');
    expect(provisionalExerciseName('mystery')).toBe('Exercise');
  });
});
