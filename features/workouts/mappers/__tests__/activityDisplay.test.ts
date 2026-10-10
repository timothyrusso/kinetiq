import { tr } from '@/features/core/translations';
import { aDurationEntry, anActivity, aRepsOnlyEntry } from '@/features/workouts/__fixtures__/builders';
import { activityDisplay } from '@/features/workouts/mappers/activityDisplay';

describe('activityDisplay', () => {
  it('leads a lift with its volume in the user units', () => {
    expect(activityDisplay(anActivity(), 'metric').headline).toBe('1,000 kg');
  });

  it('leads a workout with no weighted set with its duration', () => {
    const bodyweight = anActivity({ strength: { entries: [], totalVolumeKg: 0, totalSets: 3, personalRecords: [] } });

    expect(activityDisplay(bodyweight, 'metric').headline).toBe('45m');
  });

  it('leads a workout of reps-only and timed exercises with its duration, and counts their sets', () => {
    const unloaded = anActivity({
      strength: { entries: [aRepsOnlyEntry(), aDurationEntry()], totalVolumeKg: 0, totalSets: 4, personalRecords: [] },
    });

    expect(activityDisplay(unloaded, 'metric').headline).toBe('45m');
    expect(activityDisplay(unloaded, 'metric').meta).toContainEqual({
      icon: 'layers',
      label: tr('workout.set', { count: 4 }),
    });
  });

  it('lists the duration and the sets under the title', () => {
    expect(activityDisplay(anActivity(), 'metric').meta).toEqual([
      { icon: 'clock', label: '45m' },
      { icon: 'layers', label: tr('workout.set', { count: 2 }) },
    ]);
  });

  it('leaves out the sets when there are none', () => {
    const plain = anActivity({ strength: null });

    expect(activityDisplay(plain, 'metric').meta).toEqual([{ icon: 'clock', label: '45m' }]);
  });

  it('speaks a lift with its sets, volume and duration', () => {
    expect(activityDisplay(anActivity(), 'imperial').accessibilityLabel).toBe(
      tr('followups.a11yLift', {
        title: 'Push Day',
        sets: tr('workout.set', { count: 2 }),
        volume: '2205 lb',
        duration: '45m',
      }),
    );
  });

  it('speaks a workout with no volume with its title and duration only', () => {
    expect(activityDisplay(anActivity({ strength: null }), 'metric').accessibilityLabel).toBe(
      tr('followups.a11yPlain', { title: 'Push Day', duration: '45m' }),
    );
  });
});
