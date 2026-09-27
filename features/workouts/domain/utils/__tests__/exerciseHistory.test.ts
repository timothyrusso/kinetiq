import { anActivity, anEntry, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { EMPTY_EXERCISE_HISTORY, summariseExerciseHistory } from '@/features/workouts/domain/utils/exerciseHistory';

const DAY = 86_400_000;

const benchOn = (id: string, startedAt: number, weightKg: number) =>
  anActivity({
    id: ActivityId.make(id),
    startedAt,
    strength: {
      entries: [anEntry({ sets: [aSet({ weightKg, estimated1rm: null })] })],
      totalVolumeKg: 5 * weightKg,
      totalSets: 1,
      personalRecords: [],
    },
  });

describe('summariseExerciseHistory', () => {
  it('is empty for an exercise nobody logged', () => {
    expect(summariseExerciseHistory('wger:73', [])).toBe(EMPTY_EXERCISE_HISTORY);
  });

  it('lists the workouts newest first and draws the heaviest-set line oldest first', () => {
    const history = summariseExerciseHistory('wger:73', [
      benchOn('session-a', WORKOUT_TIME, 90),
      benchOn('session-b', WORKOUT_TIME + DAY, 100),
    ]);

    expect(history.sessions.map(session => session.activityId)).toEqual(['session-b', 'session-a']);
    expect(history.weightTrend.map(point => point.weightKg)).toEqual([90, 100]);
    expect(history).toMatchObject({
      sessionsCount: 2,
      bestWeightKg: 100,
      bestReps: 5,
      bestEstimated1rmKg: 116.5,
      bestVolumeKg: 500,
      firstPerformedAt: WORKOUT_TIME,
      lastPerformedAt: WORKOUT_TIME + DAY,
    });
  });

  it('never matches an id that only contains the one asked for', () => {
    const other = anActivity({
      strength: { entries: [anEntry({ exerciseId: 'wger:173' })], totalVolumeKg: 1, totalSets: 1, personalRecords: [] },
    });

    expect(summariseExerciseHistory('wger:73', [other]).sessionsCount).toBe(0);
  });

  it('counts a skipped exercise as a workout with no load, left off the line', () => {
    const skipped = anActivity({
      strength: {
        entries: [anEntry({ sets: [aSet({ completed: false })] })],
        totalVolumeKg: 0,
        totalSets: 0,
        personalRecords: [],
      },
    });

    const history = summariseExerciseHistory('wger:73', [skipped]);

    expect(history.sessions[0]).toMatchObject({ completedSets: 0, topWeightKg: 0, estimated1rmKg: null });
    expect(history.weightTrend).toEqual([]);
    expect(history.bestWeightKg).toBeNull();
  });
});
