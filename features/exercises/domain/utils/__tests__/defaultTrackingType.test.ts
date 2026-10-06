import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { defaultTrackingType } from '@/features/exercises/domain/utils/defaultTrackingType';

describe('defaultTrackingType', () => {
  it('times cardio, even when it needs no equipment', () => {
    expect(defaultTrackingType(anExercise({ trainingType: 'cardio', force: null, equipmentKeys: ['body-only'] }))).toBe(
      'duration',
    );
  });

  it('times a stretch', () => {
    expect(
      defaultTrackingType(anExercise({ trainingType: 'stretching', force: 'static', equipmentKeys: ['body-only'] })),
    ).toBe('duration');
  });

  it.each([
    ['plank', ['body-only'] as const],
    ['hollow hold', ['body-only'] as const],
    ['wall sit', ['body-only'] as const],
    ['ring support hold', ['rings'] as const],
  ])('times a static strength hold (%s) before the bodyweight rule', (_name, equipmentKeys) => {
    expect(defaultTrackingType(anExercise({ trainingType: 'strength', force: 'static', equipmentKeys }))).toBe(
      'duration',
    );
  });

  it('counts reps only for a bodyweight movement such as the pull-up', () => {
    expect(
      defaultTrackingType(anExercise({ trainingType: 'strength', force: 'pull', equipmentKeys: ['body-only'] })),
    ).toBe('repsOnly');
  });

  it('logs weight and reps for a barbell lift', () => {
    expect(defaultTrackingType(anExercise())).toBe('weightReps');
  });

  it('logs weight and reps for an exercise read from a snapshot, which keeps no dataset keys', () => {
    expect(defaultTrackingType(anExercise({ trainingType: null, force: null, equipmentKeys: [] }))).toBe('weightReps');
  });
});
