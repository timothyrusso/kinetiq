import { aDurationItem, aRepsOnlyItem, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { uniformSets } from '@/features/routines/domain/utils/itemTargets';
import { estimateMinutes, plannedVolumeKg } from '@/features/routines/domain/utils/routinePlan';

describe('plannedVolumeKg', () => {
  it('adds reps times weight over every planned set, as a workout counts its volume', () => {
    expect(plannedVolumeKg([aRoutineItem({ sets: uniformSets(5, 10, 1) })])).toBe(50);
    expect(plannedVolumeKg([aRoutineItem(), aRoutineItem({ sets: uniformSets(2, 5, 20) })])).toBe(
      3 * 8 * 60 + 2 * 5 * 20,
    );
  });

  it('reads each set on its own reps and weight', () => {
    const sets = [
      { type: 'weightReps' as const, index: 0, reps: 10, weightKg: 50, targetRpe: null },
      { type: 'weightReps' as const, index: 1, reps: 8, weightKg: 60, targetRpe: 8 },
      { type: 'weightReps' as const, index: 2, reps: 6, weightKg: 70, targetRpe: 9 },
    ];

    expect(plannedVolumeKg([aRoutineItem({ sets })])).toBe(10 * 50 + 8 * 60 + 6 * 70);
  });

  it('is 0 for a bodyweight routine', () => {
    expect(plannedVolumeKg([aRoutineItem({ sets: uniformSets(3, 8, 0) })])).toBe(0);
  });

  it('counts only weight and reps items: reps-only and timed items lift no load', () => {
    expect(plannedVolumeKg([aRoutineItem(), aRepsOnlyItem(), aDurationItem()])).toBe(3 * 8 * 60);
  });
});

describe('estimateMinutes', () => {
  it('counts three seconds a rep, the rest after each set and twenty seconds per exercise', () => {
    expect(estimateMinutes([aRoutineItem({ sets: uniformSets(3, 10, 60), restSeconds: 90 })])).toBe(
      Math.round((3 * (10 * 3 + 90) + 20) / 60),
    );
  });

  it('counts a reps-only set by its reps', () => {
    expect(estimateMinutes([aRepsOnlyItem({ restSeconds: 60 })])).toBe(Math.round((3 * (8 * 3 + 60) + 20) / 60));
  });

  it('counts a timed set by its own seconds', () => {
    const plank = aDurationItem({
      restSeconds: 60,
      sets: [0, 1, 2, 3].map(index => ({ type: 'duration' as const, index, durationSeconds: 120, targetRpe: null })),
    });

    expect(estimateMinutes([plank])).toBe(Math.round((4 * (120 + 60) + 20) / 60));
  });

  it('is never less than a minute', () => {
    expect(estimateMinutes([])).toBe(1);
  });
});
