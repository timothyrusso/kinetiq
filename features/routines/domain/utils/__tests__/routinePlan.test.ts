import { aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { estimateMinutes, plannedVolumeKg } from '@/features/routines/domain/utils/routinePlan';

describe('plannedVolumeKg', () => {
  it('adds sets times weight over the items', () => {
    expect(plannedVolumeKg([aRoutineItem(), aRoutineItem({ sets: 2, weightKg: 20 })])).toBe(3 * 60 + 2 * 20);
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
