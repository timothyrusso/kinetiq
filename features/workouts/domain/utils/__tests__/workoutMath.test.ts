import { anEntry, anOpenSet, anotherEntry, aSession, aSet } from '@/features/workouts/__fixtures__/builders';
import {
  completedSetCount,
  estimateCalories,
  estimatedOneRepMax,
  restRemaining,
  sessionProgress,
  toCompletedWorkout,
  totalVolumeKg,
  withEstimated1rm,
} from '@/features/workouts/domain/utils/workoutMath';

describe('estimatedOneRepMax', () => {
  it('is the load itself for a single rep', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
  });

  it('rounds Epley to the half kilogram', () => {
    expect(estimatedOneRepMax(100, 5)).toBe(116.5);
  });

  it('has no estimate for bodyweight, no reps, or more than 15 reps', () => {
    expect(estimatedOneRepMax(0, 5)).toBeNull();
    expect(estimatedOneRepMax(100, 0)).toBeNull();
    expect(estimatedOneRepMax(60, 16)).toBeNull();
  });
});

describe('withEstimated1rm', () => {
  it('writes the estimate of a completed set', () => {
    expect(withEstimated1rm(aSet({ reps: 1, weightKg: 140, estimated1rm: null })).estimated1rm).toBe(140);
  });

  it('leaves an open set as it is', () => {
    const open = anOpenSet();

    expect(withEstimated1rm(open)).toBe(open);
  });
});

describe('the session totals', () => {
  it('count volume and sets over the completed sets only', () => {
    const entries = [anEntry(), anotherEntry()];

    expect(totalVolumeKg(entries)).toBe(1000);
    expect(completedSetCount(entries)).toBe(2);
  });

  it('report progress as sets done over sets planned', () => {
    expect(sessionProgress(aSession())).toEqual({ completed: 2, planned: 5, ratio: 0.4 });
  });

  it('report no progress for a session with no sets', () => {
    expect(sessionProgress(aSession({ entries: [] }))).toEqual({ completed: 0, planned: 0, ratio: 0 });
  });
});

describe('estimateCalories', () => {
  it('is 370 kcal an hour for the reference athlete', () => {
    expect(estimateCalories(3600)).toBe(370);
  });

  it('is zero for a negative duration', () => {
    expect(estimateCalories(-60)).toBe(0);
  });
});

describe('restRemaining', () => {
  it('rounds the remainder up to the whole second', () => {
    expect(restRemaining(10_100, 10_000)).toBe(1);
    expect(restRemaining(70_000, 10_000)).toBe(60);
  });

  it('is zero with no rest or after the deadline', () => {
    expect(restRemaining(null, 10_000)).toBe(0);
    expect(restRemaining(9_000, 10_000)).toBe(0);
  });
});

describe('toCompletedWorkout', () => {
  it('records the counted time, the derived totals and the session id', () => {
    const workout = toCompletedWorkout(aSession({ elapsedSeconds: 2700 }), 5_000);

    expect(workout).toMatchObject({
      id: 'session-mbz1a2b3',
      routineId: 'rtn_push',
      title: 'Push Day',
      endedAt: 5_000,
      durationSeconds: 2700,
      caloriesKcal: 278,
      totalVolumeKg: 1000,
      totalSets: 2,
    });
  });
});
