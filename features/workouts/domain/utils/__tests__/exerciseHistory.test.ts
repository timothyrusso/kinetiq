import {
  aDurationEntry,
  aDurationSet,
  anActivity,
  anEntry,
  aRepsOnlyEntry,
  aRepsOnlySet,
  aSet,
  WORKOUT_TIME,
} from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
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
    expect(summariseExerciseHistory('ex:barbell-bench-press', [])).toBe(EMPTY_EXERCISE_HISTORY);
  });

  it('lists the workouts newest first and draws the heaviest-set line oldest first', () => {
    const history = summariseExerciseHistory('ex:barbell-bench-press', [
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
      strength: {
        entries: [anEntry({ exerciseId: 'ex:barbell-curl' })],
        totalVolumeKg: 1,
        totalSets: 1,
        personalRecords: [],
      },
    });

    expect(summariseExerciseHistory('ex:barbell-bench-press', [other]).sessionsCount).toBe(0);
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

    const history = summariseExerciseHistory('ex:barbell-bench-press', [skipped]);

    expect(history.sessions[0]).toMatchObject({ completedSets: 0, topWeightKg: 0, estimated1rmKg: null });
    expect(history.weightTrend).toEqual([]);
    expect(history.bestWeightKg).toBeNull();
  });
});

/** A workout on `startedAt` with `entry` alone. */
const workoutOn = (id: string, startedAt: number, entry: StrengthEntry) =>
  anActivity({
    id: ActivityId.make(id),
    startedAt,
    strength: { entries: [entry], totalVolumeKg: 0, totalSets: entry.sets.length, personalRecords: [] },
  });

describe('summariseExerciseHistory per tracking type', () => {
  it('charts most reps per reps-only workout and keeps them out of the loaded bests', () => {
    const pullups = (reps: number) =>
      aRepsOnlyEntry({ exerciseId: 'ex:pullups', sets: [aRepsOnlySet({ reps }), aRepsOnlySet({ index: 1, reps: 4 })] });

    const history = summariseExerciseHistory('ex:pullups', [
      workoutOn('session-a', WORKOUT_TIME, pullups(8)),
      workoutOn('session-b', WORKOUT_TIME + DAY, pullups(11)),
    ]);

    expect(history.repsTrend.map(point => point.reps)).toEqual([8, 11]);
    expect(history.sessions[0]).toMatchObject({ trackingType: 'repsOnly', topReps: 11, volumeKg: 0, topWeightKg: 0 });
    expect(history).toMatchObject({
      weightTrend: [],
      durationTrend: [],
      mostReps: 11,
      bestReps: null,
      bestWeightKg: null,
      bestEstimated1rmKg: null,
      bestVolumeKg: null,
      longestDurationSeconds: null,
    });
  });

  it('charts the longest set per timed workout', () => {
    const plank = (durationSeconds: number) =>
      aDurationEntry({ sets: [aDurationSet({ durationSeconds }), aDurationSet({ index: 1, durationSeconds: 20 })] });

    const history = summariseExerciseHistory('ex:plank', [
      workoutOn('session-a', WORKOUT_TIME, plank(60)),
      workoutOn('session-b', WORKOUT_TIME + DAY, plank(45)),
    ]);

    expect(history.durationTrend.map(point => point.durationSeconds)).toEqual([60, 45]);
    expect(history.sessions[0]).toMatchObject({ trackingType: 'duration', topDurationSeconds: 45, topReps: 0 });
    expect(history).toMatchObject({ longestDurationSeconds: 60, mostReps: null, bestReps: null, sessionsCount: 2 });
  });

  it('keeps each type to its own bests when one exercise was tracked two ways', () => {
    const history = summariseExerciseHistory('ex:pullups', [
      workoutOn(
        'session-a',
        WORKOUT_TIME,
        anEntry({ exerciseId: 'ex:pullups', sets: [aSet({ reps: 6, weightKg: 20 })] }),
      ),
      workoutOn('session-b', WORKOUT_TIME + DAY, aRepsOnlyEntry({ sets: [aRepsOnlySet({ reps: 14 })] })),
    ]);

    expect(history).toMatchObject({ bestReps: 6, mostReps: 14, bestWeightKg: 20, bestVolumeKg: 120, sessionsCount: 2 });
    expect(history.weightTrend.map(point => point.weightKg)).toEqual([20]);
    expect(history.repsTrend.map(point => point.reps)).toEqual([14]);
  });
});
