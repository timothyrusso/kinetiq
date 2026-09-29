import { act, renderHook } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { anActivity, anEntry, anOpenSet, aRecord } from '@/features/workouts/__fixtures__/builders';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import { useActivityStrengthLogic } from '@/features/workouts/ui/components/ActivityStrength/ActivityStrength.logic';

const renderStrength = (activity: Activity = anActivity()) =>
  renderHook(() => useActivityStrengthLogic(activity, 'metric'));

const EMPTY: Activity = anActivity({ strength: null });

describe('useActivityStrengthLogic', () => {
  it('counts the sets done over the sets planned', async () => {
    const activity = anActivity({
      strength: {
        entries: [anEntry({ sets: [...anEntry().sets, anOpenSet({ index: 2 })] })],
        totalVolumeKg: 1000,
        totalSets: 2,
        personalRecords: [],
      },
    });

    const { result } = await renderStrength(activity);

    expect(result.current.derived.metrics.sets).toBe('2/3');
  });

  it('says why each metric is missing on an empty workout', async () => {
    const { result } = await renderStrength(EMPTY);

    expect(result.current.derived.metrics).toMatchObject({
      volume: null,
      volumeNote: tr('activity.bodyweightWork'),
      sets: null,
      setsNote: tr('activity.noSets'),
      exercises: null,
      exercisesNote: tr('activity.nothingAdded'),
    });
  });

  it('counts the exercises and shows the volume when there is some', async () => {
    const { result } = await renderStrength();

    expect(result.current.derived.metrics.exercises).toBe('1');
    expect(result.current.derived.metrics.volume).not.toBeNull();
  });

  it('says a first record is the first of its kind', async () => {
    const activity = anActivity({
      strength: { entries: [anEntry()], totalVolumeKg: 1000, totalSets: 2, personalRecords: [aRecord()] },
    });

    const { result } = await renderStrength(activity);

    expect(result.current.derived.recordRows).toEqual([
      {
        key: 'wger:73-est1rm',
        name: 'Bench Press',
        detail: tr('records.est1rm') + tr('activity.firstOfKind'),
        value: '116.5 kg',
      },
    ]);
  });

  it('says what a beaten record was up from', async () => {
    const activity = anActivity({
      strength: {
        entries: [anEntry()],
        totalVolumeKg: 1000,
        totalSets: 2,
        personalRecords: [aRecord({ previousValue: 110 })],
      },
    });

    const { result } = await renderStrength(activity);

    expect(result.current.derived.recordRows[0]?.detail).toBe(
      tr('records.est1rm') + tr('activity.upFrom', { value: '110 kg' }),
    );
  });

  it('keys each exercise card by position, so a repeated exercise gets two', async () => {
    const activity = anActivity({
      strength: { entries: [anEntry(), anEntry()], totalVolumeKg: 2000, totalSets: 4, personalRecords: [] },
    });

    const { result } = await renderStrength(activity);

    expect(result.current.derived.cards.map(card => card.key)).toEqual(['wger:73-0', 'wger:73-1']);
  });

  it('opens an exercise on its detail screen', async () => {
    const { result } = await renderStrength();

    await act(async () => result.current.effects.openExercise('wger:73'));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.exerciseDetail('wger:73') }]);
  });
});
