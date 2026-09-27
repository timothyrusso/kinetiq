import { anActivity, anEntry, anotherEntry, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
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
      strength: { entries: [anEntry(), anotherEntry()], totalVolumeKg: 1000, totalSets: 2, personalRecords: [] },
    });

    expect([...indexPreviousLifts([both], new Set(['wger:74'])).keys()]).toEqual(['wger:74']);
  });

  it('indexes every exercise when none is asked for', () => {
    const both = anActivity({
      strength: { entries: [anEntry(), anotherEntry()], totalVolumeKg: 1000, totalSets: 2, personalRecords: [] },
    });

    expect([...indexPreviousLifts([both], new Set()).keys()]).toEqual(['wger:73', 'wger:74']);
  });
});
