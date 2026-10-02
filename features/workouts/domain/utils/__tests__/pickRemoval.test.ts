import { anEntry, anOpenSet, anotherEntry, aSession } from '@/features/workouts/__fixtures__/builders';
import { pickRemoval } from '@/features/workouts/domain/utils/pickRemoval';

describe('pickRemoval', () => {
  it('removes an exercise with no completed set', () => {
    expect(pickRemoval(aSession().entries, 'ex:barbell-squat')).toEqual({ kind: 'removable', entryIndex: 1 });
  });

  it('keeps an exercise with a completed set', () => {
    expect(pickRemoval(aSession().entries, 'ex:barbell-bench-press')).toEqual({ kind: 'hasCompletedSet' });
  });

  it('keeps the workout’s last exercise', () => {
    expect(pickRemoval([anotherEntry()], 'ex:barbell-squat')).toEqual({ kind: 'lastExercise' });
  });

  it('judges the later entry of an exercise that is in twice', () => {
    const twice = [anEntry(), anotherEntry(), anEntry({ sets: [anOpenSet()] })];

    expect(pickRemoval(twice, 'ex:barbell-bench-press')).toEqual({ kind: 'removable', entryIndex: 2 });
  });

  it('has nothing to remove for an exercise not in the workout, or no workout', () => {
    expect(pickRemoval(aSession().entries, 'ex:pullups')).toEqual({ kind: 'absent' });
    expect(pickRemoval(undefined, 'ex:barbell-squat')).toEqual({ kind: 'absent' });
  });
});
