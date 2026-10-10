import {
  aDurationEntry,
  anActivity,
  anEntry,
  anOpenSet,
  anotherEntry,
  aRepsOnlyEntry,
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
    const previous = indexPreviousLifts([latest, anActivity()], new Set(['ex:barbell-bench-press']));

    expect(previous.get('ex:barbell-bench-press')).toMatchObject({
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

    expect([...indexPreviousLifts([both], new Set(['ex:barbell-squat'])).keys()]).toEqual(['ex:barbell-squat']);
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

    expect([...indexPreviousLifts([both], new Set()).keys()]).toEqual(['ex:barbell-bench-press', 'ex:barbell-squat']);
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

    expect(
      indexPreviousLifts([partly], new Set(['ex:barbell-bench-press'])).get('ex:barbell-bench-press'),
    ).toMatchObject({
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

    expect(indexPreviousLifts([planned, done], new Set(['ex:barbell-squat'])).get('ex:barbell-squat')).toMatchObject({
      performedAt: WORKOUT_TIME,
      sets: [{ reps: 8, weightKg: 40 }],
    });
  });

  it('has no previous lift for an exercise never ticked', () => {
    const planned = anActivity({
      strength: { entries: [anotherEntry()], totalVolumeKg: 0, totalSets: 0, personalRecords: [] },
    });

    expect(indexPreviousLifts([planned], new Set(['ex:barbell-squat'])).has('ex:barbell-squat')).toBe(false);
  });
});

describe('indexPreviousLifts per tracking type', () => {
  it('keeps a reps-only and a timed last time in their own units, with no estimate or volume', () => {
    const workout = anActivity({
      strength: {
        entries: [aRepsOnlyEntry(), aDurationEntry()],
        totalVolumeKg: 0,
        totalSets: 4,
        personalRecords: [],
      },
    });

    const previous = indexPreviousLifts([workout], new Set());

    expect(previous.get('ex:pullups')).toMatchObject({
      trackingType: 'repsOnly',
      sets: [
        { type: 'repsOnly', reps: 12 },
        { type: 'repsOnly', reps: 12 },
      ],
      bestEstimated1rm: null,
      totalVolumeKg: 0,
    });
    expect(previous.get('ex:plank')).toMatchObject({
      trackingType: 'duration',
      sets: [
        { type: 'duration', durationSeconds: 45 },
        { type: 'duration', durationSeconds: 45 },
      ],
      bestEstimated1rm: null,
      totalVolumeKg: 0,
    });
  });

  it('reads a loaded last time with its type and volume', () => {
    expect(indexPreviousLifts([latest], new Set()).get('ex:barbell-bench-press')).toMatchObject({
      trackingType: 'weightReps',
      totalVolumeKg: 525,
    });
  });
});
