import {
  aDurationEntry,
  aDurationSet,
  anEntry,
  aRepsOnlyEntry,
  aRepsOnlySet,
  aSet,
} from '@/features/workouts/__fixtures__/builders';
import { entriesFromColumn, entriesToColumn } from '@/features/workouts/data/adapters/decodeRows';

describe('entriesFromColumn', () => {
  it('reads back an entry of each tracking type as it was written', () => {
    const entries = [anEntry(), aRepsOnlyEntry(), aDurationEntry()];

    expect(entriesFromColumn(entriesToColumn(entries))).toEqual(entries);
  });

  it('drops an entry holding a set of another type than its own, and keeps the rest', () => {
    const column = JSON.stringify([
      { ...aRepsOnlyEntry(), sets: [aRepsOnlySet(), aDurationSet()] },
      { ...aDurationEntry(), sets: [aSet()] },
      aDurationEntry(),
    ]);

    expect(entriesFromColumn(column)).toEqual([aDurationEntry()]);
  });

  it('drops an entry of a type the app does not know', () => {
    const column = JSON.stringify([{ ...aRepsOnlyEntry(), trackingType: 'distance' }, anEntry()]);

    expect(entriesFromColumn(column)).toEqual([anEntry()]);
  });

  it('drops an entry whose sets lack their type once the entry names its own', () => {
    const { type: _type, ...untagged } = aRepsOnlySet();
    const column = JSON.stringify([{ ...aRepsOnlyEntry(), sets: [untagged] }]);

    expect(entriesFromColumn(column)).toEqual([]);
  });

  it('drops an entry written before tracking types, which names no type', () => {
    const { trackingType: _entryType, ...untyped } = anEntry();
    const column = JSON.stringify([
      { ...untyped, sets: untyped.sets.map(({ type: _type, ...set }) => set) },
      aRepsOnlyEntry(),
    ]);

    expect(entriesFromColumn(column)).toEqual([aRepsOnlyEntry()]);
  });

  it('fills what an older write of each type left out', () => {
    const column = JSON.stringify([
      {
        trackingType: 'duration',
        exerciseId: 'ex:plank',
        exerciseName: 'Plank',
        sets: [{ type: 'duration', index: 0, durationSeconds: 40 }],
      },
    ]);

    expect(entriesFromColumn(column)).toEqual([
      aDurationEntry({
        restSeconds: 90,
        sets: [aDurationSet({ durationSeconds: 40, completed: false })],
      }),
    ]);
  });
});
