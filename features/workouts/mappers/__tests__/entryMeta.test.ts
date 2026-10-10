import { tr } from '@/features/core/translations';
import {
  aDurationEntry,
  aDurationSet,
  anEntry,
  anOpenSet,
  aRepsOnlyEntry,
  aRepsOnlySet,
} from '@/features/workouts/__fixtures__/builders';
import { entryMeta } from '@/features/workouts/mappers/entryMeta';

const done = (count: number, planned: number) => ({
  icon: 'checkCircle',
  label: `${count}/${planned}`,
  a11y: tr('workoutFlow.setsDone', { done: count, planned, word: tr('session.setWord', { count: planned }) }),
});

describe('entryMeta', () => {
  it('reads a loaded exercise as sets, reps, the first set’s load and the sets done', () => {
    expect(entryMeta(anEntry({ sets: [anOpenSet(), anOpenSet({ index: 1, reps: 8 })] }), 'metric')).toEqual([
      { icon: 'layers', label: tr('workout.set', { count: 2 }) },
      { icon: 'refresh', label: tr('details.repsValue', { reps: '5-8' }) },
      { icon: 'dumbbell', label: '100 kg' },
      done(0, 2),
    ]);
  });

  it('says bodyweight instead of 0 kg', () => {
    expect(entryMeta(anEntry({ sets: [anOpenSet({ weightKg: 0 })] }), 'metric')).toContainEqual({
      icon: 'dumbbell',
      label: tr('itemEditor.bodyweightShort'),
      a11y: tr('details.bodyweightA11y'),
    });
  });

  it('reads a reps-only exercise with its reps and no load', () => {
    expect(entryMeta(aRepsOnlyEntry(), 'metric')).toEqual([
      { icon: 'layers', label: tr('workout.set', { count: 2 }) },
      { icon: 'refresh', label: tr('details.repsValue', { reps: '12' }) },
      done(2, 2),
    ]);
  });

  it('reads a timed exercise with its time per set as m:ss', () => {
    const plank = aDurationEntry({
      sets: [aDurationSet({ durationSeconds: 30 }), aDurationSet({ index: 1, durationSeconds: 90, completed: false })],
    });

    expect(entryMeta(plank, 'metric')).toEqual([
      { icon: 'layers', label: tr('workout.set', { count: 2 }) },
      { icon: 'timer', label: '0:30-1:30' },
      done(1, 2),
    ]);
  });

  it('reads an exercise with no sets as none done, with no values', () => {
    expect(entryMeta(aRepsOnlyEntry({ sets: [] }), 'metric')).toEqual([
      { icon: 'layers', label: tr('workout.set', { count: 0 }) },
      done(0, 0),
    ]);
  });

  it('reads one time for every set when they agree', () => {
    expect(entryMeta(aDurationEntry({ sets: [aDurationSet({ durationSeconds: 3600 })] }), 'metric')[1]).toEqual({
      icon: 'timer',
      label: '60:00',
    });
    expect(entryMeta(aRepsOnlyEntry({ sets: [aRepsOnlySet({ reps: 3 })] }), 'metric')[1]).toEqual({
      icon: 'refresh',
      label: tr('details.repsValue', { reps: '3' }),
    });
  });
});
