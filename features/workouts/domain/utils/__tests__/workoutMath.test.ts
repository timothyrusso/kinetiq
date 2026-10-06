import {
  aDurationEntry,
  aDurationSet,
  anEntry,
  anOpenSet,
  anotherEntry,
  aRepsOnlyEntry,
  aRepsOnlySet,
  aSession,
  aSet,
} from '@/features/workouts/__fixtures__/builders';
import { estimatedOneRepMax, withEstimated1rm } from '@/features/workouts/domain/utils/oneRepMax';
import {
  completedSetCount,
  restRemaining,
  sessionProgress,
  setVolumeKg,
  toCompletedWorkout,
  totalVolumeKg,
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

  it('count volume over the loaded sets only, and the completed sets of every type', () => {
    const entries = [anEntry(), aRepsOnlyEntry(), aDurationEntry()];

    expect(totalVolumeKg(entries)).toBe(1000);
    expect(completedSetCount(entries)).toBe(6);
  });

  it('give a set volume only when it is loaded', () => {
    expect(setVolumeKg(aSet())).toBe(500);
    expect(setVolumeKg(aRepsOnlySet({ reps: 20 }))).toBe(0);
    expect(setVolumeKg(aDurationSet({ durationSeconds: 600 }))).toBe(0);
  });

  it('report progress as sets done over sets planned', () => {
    expect(sessionProgress(aSession())).toEqual({ completed: 2, planned: 5, ratio: 0.4 });
  });

  it('report no progress for a session with no sets', () => {
    expect(sessionProgress(aSession({ entries: [] }))).toEqual({ completed: 0, planned: 0, ratio: 0 });
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
      totalVolumeKg: 1000,
      totalSets: 2,
    });
  });

  it('records the entries without the routine item and rows they were planned from', () => {
    const planned = anEntry({ routineItemId: 'rit_bench', sets: [aSet({ routineSetIndex: 0 })] });

    const workout = toCompletedWorkout(aSession({ entries: [planned], routineItemIds: ['rit_bench'] }), 5_000);

    expect(workout.entries).toEqual([anEntry({ sets: [aSet()] })]);
    expect(JSON.stringify(workout.entries)).not.toContain('routine');
  });

  it('records each entry with its tracking type and its sets tagged the same', () => {
    const timed = aDurationEntry({ routineItemId: 'rit_plank', sets: [aDurationSet({ routineSetIndex: 0 })] });

    const workout = toCompletedWorkout(aSession({ entries: [aRepsOnlyEntry(), timed] }), 5_000);

    expect(workout.entries).toEqual([aRepsOnlyEntry(), aDurationEntry({ sets: [aDurationSet()] })]);
    expect(workout.totalVolumeKg).toBe(0);
    expect(workout.totalSets).toBe(3);
  });
});
