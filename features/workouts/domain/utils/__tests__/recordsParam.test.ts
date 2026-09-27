import { aRecord } from '@/features/workouts/__fixtures__/builders';
import { decodeRecordsParam } from '@/features/workouts/domain/utils/recordsParam';

describe('decodeRecordsParam', () => {
  it('reads the records a finish handed over', () => {
    expect(decodeRecordsParam(JSON.stringify([aRecord()]))).toEqual([aRecord()]);
  });

  it('reads a missing param as no records', () => {
    expect(decodeRecordsParam(undefined)).toEqual([]);
  });

  it('reads a param that is not a list of records as no records', () => {
    expect(decodeRecordsParam('{"kind":"est1rm"}')).toEqual([]);
    expect(decodeRecordsParam('not json')).toEqual([]);
  });
});
