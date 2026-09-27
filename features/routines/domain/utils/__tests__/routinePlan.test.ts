import { aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { estimateMinutes, plannedVolumeKg } from '@/features/routines/domain/utils/routinePlan';

describe('plannedVolumeKg', () => {
  it('adds sets times reps times weight over the items, as a workout counts its volume', () => {
    expect(plannedVolumeKg([aRoutineItem({ sets: 5, reps: '10', weightKg: 1 })])).toBe(50);
    expect(plannedVolumeKg([aRoutineItem(), aRoutineItem({ sets: 2, reps: '5', weightKg: 20 })])).toBe(
      3 * 8 * 60 + 2 * 5 * 20,
    );
  });

  it('reads a rep range at its bottom and a rep target that is not a number as 8', () => {
    expect(plannedVolumeKg([aRoutineItem({ sets: 1, reps: '5-8', weightKg: 10 })])).toBe(50);
    expect(plannedVolumeKg([aRoutineItem({ sets: 1, reps: 'AMRAP', weightKg: 10 })])).toBe(80);
  });

  it('is 0 for a bodyweight routine', () => {
    expect(plannedVolumeKg([aRoutineItem({ weightKg: 0 })])).toBe(0);
  });
});

describe('estimateMinutes', () => {
  it('counts three seconds a rep, the rest after each set and twenty seconds per exercise', () => {
    expect(estimateMinutes([aRoutineItem({ sets: 3, reps: '10', restSeconds: 90 })])).toBe(
      Math.round((3 * (10 * 3 + 90) + 20) / 60),
    );
  });

  it('is never less than a minute', () => {
    expect(estimateMinutes([])).toBe(1);
  });
});
