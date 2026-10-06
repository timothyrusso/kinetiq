import { tr } from '@/features/core/translations';
import type { PreviousLift, PreviousSet } from '@/features/workouts/domain/entities/PreviousLift';
import { lastTimeValue } from '@/features/workouts/mappers/lastTimeValue';

const aLift = (trackingType: PreviousLift['trackingType'], sets: readonly PreviousSet[]): PreviousLift => ({
  exerciseId: 'ex:any',
  exerciseName: 'Any',
  trackingType,
  sets,
  bestEstimated1rm: null,
  totalVolumeKg: 0,
  performedAt: 1,
});

describe('lastTimeValue', () => {
  it('names the heaviest loaded set with its reps, in the user units', () => {
    const lift = aLift('weightReps', [
      { type: 'weightReps', reps: 8, weightKg: 80, estimated1rm: null },
      { type: 'weightReps', reps: 5, weightKg: 82.5, estimated1rm: null },
    ]);

    expect(lastTimeValue(lift, 'metric')).toBe('82.5 kg × 5');
  });

  it('says a loaded exercise done at bodyweight with its reps', () => {
    const lift = aLift('weightReps', [{ type: 'weightReps', reps: 12, weightKg: 0, estimated1rm: null }]);

    expect(lastTimeValue(lift, 'metric')).toBe(tr('exerciseDetail.bodyweightTimes', { reps: 12 }));
  });

  it('names the most reps of a reps-only exercise', () => {
    const lift = aLift('repsOnly', [
      { type: 'repsOnly', reps: 10 },
      { type: 'repsOnly', reps: 14 },
    ]);

    expect(lastTimeValue(lift, 'metric')).toBe(tr('details.repsValue', { reps: 14 }));
  });

  it('names the longest hold of a timed exercise, as m:ss', () => {
    const lift = aLift('duration', [
      { type: 'duration', durationSeconds: 45 },
      { type: 'duration', durationSeconds: 90 },
    ]);

    expect(lastTimeValue(lift, 'metric')).toBe('1:30');
  });

  it('has nothing to say when no set was recorded', () => {
    expect(lastTimeValue(aLift('duration', []), 'metric')).toBeNull();
  });
});
