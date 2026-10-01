import { Schema } from 'effect';
import { encodeWatchRoutines } from '@/features/watch-bridge/data/adapters/encodeWatchRoutines';
import { ITEM_BOUNDS } from '@/features/watch-bridge/domain/entities/WatchBounds';
import {
  type WatchRoutinesDocument,
  WatchRoutinesDocumentSchema,
} from '@/features/watch-bridge/domain/schemas/WatchRoutinesDocumentSchema';

type Item = WatchRoutinesDocument['routines'][number]['items'][number];

const item: Item = {
  id: 'rit_1',
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench Press',
  sets: [
    { reps: 10, weightKg: 60, targetRpe: null },
    { reps: 8, weightKg: 65, targetRpe: 8 },
    { reps: 6, weightKg: 70, targetRpe: 9.5 },
  ],
  restSeconds: 120,
  notes: null,
};

/** A `kinetiq.watch-routines` v2 snapshot, keys in wire order. */
const snapshot: WatchRoutinesDocument = {
  format: 'kinetiq.watch-routines',
  version: 2,
  exportedAt: '2026-09-25T10:00:00.000Z',
  unitSystem: 'imperial',
  routines: [{ id: 'rtn_1', name: 'Push', items: [item] }],
};

/** The bytes the watch's Swift core decodes (`targets/watch-tests`). */
const WIRE_JSON =
  '{"format":"kinetiq.watch-routines","version":2,"exportedAt":"2026-09-25T10:00:00.000Z","unitSystem":"imperial",' +
  '"routines":[{"id":"rtn_1","name":"Push","items":[{"id":"rit_1","exerciseId":"ex:barbell-bench-press","exerciseName":"Bench Press",' +
  '"sets":[{"reps":10,"weightKg":60,"targetRpe":null},{"reps":8,"weightKg":65,"targetRpe":8},' +
  '{"reps":6,"weightKg":70,"targetRpe":9.5}],"restSeconds":120,"notes":null}]}]}';

const withItem = (patch: Partial<Item>): WatchRoutinesDocument => ({
  ...snapshot,
  routines: [{ id: 'rtn_1', name: 'Push', items: [{ ...item, ...patch }] }],
});

const decode = Schema.decodeUnknownEither(WatchRoutinesDocumentSchema);

describe('encodeWatchRoutines', () => {
  it('writes every set with its own reps, weight and target RPE, in wire order', () => {
    expect(encodeWatchRoutines(snapshot)).toBe(WIRE_JSON);
    expect(encodeWatchRoutines(snapshot)).toBe(JSON.stringify(snapshot));
  });

  it('reads back what it wrote', () => {
    expect(Schema.decodeUnknownSync(Schema.parseJson(WatchRoutinesDocumentSchema))(WIRE_JSON)).toEqual(snapshot);
  });

  it('refuses a snapshot the watch would reject', () => {
    const set = { reps: 8, weightKg: 60, targetRpe: null };
    for (const bad of [
      withItem({ sets: [{ ...set, weightKg: ITEM_BOUNDS.weightKg.max + 1 }] }),
      withItem({ sets: [{ ...set, reps: 0 }] }),
      withItem({ sets: [{ ...set, reps: ITEM_BOUNDS.reps.max + 1 }] }),
      withItem({ sets: [{ ...set, reps: 7.5 }] }),
      withItem({ sets: [{ ...set, targetRpe: ITEM_BOUNDS.rpe.max + 0.5 }] }),
      withItem({ sets: [] }),
      withItem({ sets: Array.from({ length: ITEM_BOUNDS.sets.max + 1 }, () => set) }),
    ]) {
      expect(() => encodeWatchRoutines(bad)).toThrow();
    }
  });

  it('refuses the v1 shape, where an item was a set count and one reps string', () => {
    const v1 = {
      ...snapshot,
      version: 1,
      routines: [{ id: 'rtn_1', name: 'Push', items: [{ ...item, sets: 3, reps: '8-10', weightKg: 60 }] }],
    };
    expect(decode(v1)._tag).toBe('Left');
    expect(decode({ ...v1, version: 2 })._tag).toBe('Left');
  });
});
