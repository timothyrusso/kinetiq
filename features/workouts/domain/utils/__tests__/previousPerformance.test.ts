import {
  anActivity,
  anEntry,
  anOpenSet,
  anotherEntry,
  aSet,
  WORKOUT_TIME,
} from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { indexPreviousLifts } from '@/features/workouts/domain/utils/previousPerformance';

const latest = anActivity({
  id: ActivityId.make('session-new'),
  startedAt: WORKOUT_TIME + 1,
  strength: {
    entries: [anEntry({ sets: [aSet({ weightKg: 105, estimated1rm: 122.5 })] })],
    totalVolumeKg: 525,
    totalSets: 1,
    personalRecords: [],
  },
});

describe('indexPreviousLifts', () => {
  it('keeps the most recent workout of each exercise', () => {
    const previous = indexPreviousLifts([latest, anActivity()], new Set(['wger:73']));

    expect(previous.get('wger:73')).toMatchObject({
      performedAt: WORKOUT_TIME + 1,
      bestEstimated1rm: 122.5,
      sets: [{ reps: 5, weightKg: 105, estimated1rm: 122.5 }],
    });
  });

  it('indexes only the exercises asked for', () => {
    const both = anActivity({
      strength: {
        entries: [anEntry(), anotherEntry({ sets: [aSet({ reps: 8, weightKg: 40 })] })],
        totalVolumeKg: 1320,
        totalSets: 3,
        personalRecords: [],
      },
    });

    expect([...indexPreviousLifts([both], new Set(['wger:74'])).keys()]).toEqual(['wger:74']);
  });

  it('indexes every exercise when none is asked for', () => {
    const both = anActivity({
      strength: {
        entries: [anEntry(), anotherEntry({ sets: [aSet({ reps: 8, weightKg: 40 })] })],
        totalVolumeKg: 1320,
        totalSets: 3,
        personalRecords: [],
      },
    });

    expect([...indexPreviousLifts([both], new Set()).keys()]).toEqual(['wger:73', 'wger:74']);
  });

  it('counts only the ticked sets, as the history does', () => {
    const partly = anActivity({
      strength: {
        entries: [anEntry({ sets: [aSet({ weightKg: 80 }), anOpenSet({ index: 1, weightKg: 120 })] })],
        totalVolumeKg: 400,
        totalSets: 1,
        personalRecords: [],
      },
    });

    expect(indexPreviousLifts([partly], new Set(['wger:73'])).get('wger:73')).toMatchObject({
      sets: [{ reps: 5, weightKg: 80 }],
      totalVolumeKg: 400,
    });
  });

  it('skips a workout where no set of the exercise was ticked, back to one where it was done', () => {
    const planned = anActivity({
      id: ActivityId.make('session-planned'),
      startedAt: WORKOUT_TIME + 1,
      strength: { entries: [anotherEntry()], totalVolumeKg: 0, totalSets: 0, personalRecords: [] },
    });
    const done = anActivity({
      strength: {
        entries: [anotherEntry({ sets: [aSet({ reps: 8, weightKg: 40 })] })],
        totalVolumeKg: 320,
        totalSets: 1,
        personalRecords: [],
      },
    });

    expect(indexPreviousLifts([planned, done], new Set(['wger:74'])).get('wger:74')).toMatchObject({
      performedAt: WORKOUT_TIME,
      sets: [{ reps: 8, weightKg: 40 }],
    });
  });

  it('has no previous lift for an exercise never ticked', () => {
    const planned = anActivity({
      strength: { entries: [anotherEntry()], totalVolumeKg: 0, totalSets: 0, personalRecords: [] },
    });

    expect(indexPreviousLifts([planned], new Set(['wger:74'])).has('wger:74')).toBe(false);
  });
});
