import { renderHook } from '@testing-library/react-native';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aRecord } from '@/features/workouts/__fixtures__/builders';
import { useRecordsPageLogic } from '@/features/workouts/ui/pages/RecordsPage/RecordsPage.logic';

describe('useRecordsPageLogic', () => {
  it('lists the records the finish handed over, in the user units', async () => {
    routerFake.setParams({ records: JSON.stringify([aRecord(), aRecord({ kind: 'maxReps', value: 12 })]) });

    const { result } = await renderHook(useRecordsPageLogic);

    expect(result.current.derived.rows).toEqual([
      { key: 'wger:73-est1rm', name: 'Bench Press', label: tr('records.est1rm'), value: '116.5 kg' },
      {
        key: 'wger:73-maxReps',
        name: 'Bench Press',
        label: tr('records.maxReps'),
        value: tr('details.repsValue', { reps: 12 }),
      },
    ]);
  });

  it('titles a single record in the singular', async () => {
    routerFake.setParams({ records: JSON.stringify([aRecord()]) });

    const { result } = await renderHook(useRecordsPageLogic);

    expect(result.current.derived.title).toBe(tr('session.recordOne'));
  });

  it('titles several records with their count', async () => {
    routerFake.setParams({ records: JSON.stringify([aRecord(), aRecord({ kind: 'volume', value: 1000 })]) });

    const { result } = await renderHook(useRecordsPageLogic);

    expect(result.current.derived.title).toBe(tr('session.recordMany', { count: 2 }));
  });

  it('shows nothing for a param that is not a list of records', async () => {
    routerFake.setParams({ records: '{"not":"records"}' });

    const { result } = await renderHook(useRecordsPageLogic);

    expect(result.current.derived.rows).toEqual([]);
  });
});
