import { Schema } from 'effect';
import { encodeWatchRoutines } from '@/features/watch-bridge/data/adapters/encodeWatchRoutines';
import { ITEM_BOUNDS } from '@/features/watch-bridge/domain/entities/WatchBounds';
import {
  type WatchRoutinesDocument,
  WatchRoutinesDocumentSchema,
} from '@/features/watch-bridge/domain/schemas/WatchRoutinesDocumentSchema';

/** A `kinetiq.watch-routines` v1 snapshot as the phone on `main` writes it, keys in wire order. */
const snapshot: WatchRoutinesDocument = {
  format: 'kinetiq.watch-routines',
  version: 1,
  exportedAt: '2026-09-25T10:00:00.000Z',
  unitSystem: 'imperial',
  routines: [
    {
      id: 'rtn_1',
      name: 'Push',
      items: [
        {
          id: 'rit_1',
          exerciseId: 'wger:73',
          exerciseName: 'Bench Press',
          sets: 4,
          reps: '8-10',
          weightKg: 60,
          restSeconds: 120,
          notes: null,
        },
      ],
    },
  ],
};

const MAIN_JSON =
  '{"format":"kinetiq.watch-routines","version":1,"exportedAt":"2026-09-25T10:00:00.000Z","unitSystem":"imperial",' +
  '"routines":[{"id":"rtn_1","name":"Push","items":[{"id":"rit_1","exerciseId":"wger:73","exerciseName":"Bench Press",' +
  '"sets":4,"reps":"8-10","weightKg":60,"restSeconds":120,"notes":null}]}]}';

describe('encodeWatchRoutines', () => {
  it('writes the same bytes as the snapshot on main', () => {
    expect(encodeWatchRoutines(snapshot)).toBe(MAIN_JSON);
    expect(encodeWatchRoutines(snapshot)).toBe(JSON.stringify(snapshot));
  });

  it('reads back what it wrote', () => {
    expect(Schema.decodeUnknownSync(Schema.parseJson(WatchRoutinesDocumentSchema))(MAIN_JSON)).toEqual(snapshot);
  });

  it('refuses a snapshot the watch would reject', () => {
    const [routine] = snapshot.routines;
    const [item] = routine?.items ?? [];
    if (routine === undefined || item === undefined) throw new Error('fixture');
    const tooHeavy = {
      ...snapshot,
      routines: [{ ...routine, items: [{ ...item, weightKg: ITEM_BOUNDS.weightKg.max + 1 }] }],
    };
    expect(() => encodeWatchRoutines(tooHeavy)).toThrow();
  });
});
