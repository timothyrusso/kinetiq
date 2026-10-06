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
  trackingType: 'weightReps',
  sets: [
    { type: 'weightReps', reps: 10, weightKg: 60, targetRpe: null },
    { type: 'weightReps', reps: 8, weightKg: 65, targetRpe: 8 },
    { type: 'weightReps', reps: 6, weightKg: 70, targetRpe: 9.5 },
  ],
  restSeconds: 120,
  notes: null,
};

const pullUps: Item = {
  id: 'rit_2',
  exerciseId: 'ex:pullups',
  exerciseName: 'Pull-up',
  trackingType: 'repsOnly',
  sets: [{ type: 'repsOnly', reps: 10, targetRpe: null }],
  restSeconds: 90,
  notes: null,
};

const plank: Item = {
  id: 'rit_3',
  exerciseId: 'ex:plank',
  exerciseName: 'Plank',
  trackingType: 'duration',
  sets: [{ type: 'duration', durationSeconds: 45, targetRpe: 7 }],
  restSeconds: 60,
  notes: null,
};

/** A `kinetiq.watch-routines` v3 snapshot, keys in wire order. */
const snapshot: WatchRoutinesDocument = {
  format: 'kinetiq.watch-routines',
  version: 3,
  exportedAt: '2026-09-25T10:00:00.000Z',
  unitSystem: 'imperial',
  routines: [{ id: 'rtn_1', name: 'Push', items: [item, pullUps, plank] }],
};

/** The bytes the watch's Swift core decodes (`targets/watch-tests`). */
const WIRE_JSON =
  '{"format":"kinetiq.watch-routines","version":3,"exportedAt":"2026-09-25T10:00:00.000Z","unitSystem":"imperial",' +
  '"routines":[{"id":"rtn_1","name":"Push","items":[{"id":"rit_1","exerciseId":"ex:barbell-bench-press",' +
  '"exerciseName":"Bench Press","trackingType":"weightReps",' +
  '"sets":[{"type":"weightReps","reps":10,"weightKg":60,"targetRpe":null},' +
  '{"type":"weightReps","reps":8,"weightKg":65,"targetRpe":8},' +
  '{"type":"weightReps","reps":6,"weightKg":70,"targetRpe":9.5}],"restSeconds":120,"notes":null},' +
  '{"id":"rit_2","exerciseId":"ex:pullups","exerciseName":"Pull-up","trackingType":"repsOnly",' +
  '"sets":[{"type":"repsOnly","reps":10,"targetRpe":null}],"restSeconds":90,"notes":null},' +
  '{"id":"rit_3","exerciseId":"ex:plank","exerciseName":"Plank","trackingType":"duration",' +
  '"sets":[{"type":"duration","durationSeconds":45,"targetRpe":7}],"restSeconds":60,"notes":null}]}]}';

const withItem = (patch: Record<string, unknown>, base: Item = item): WatchRoutinesDocument =>
  ({
    ...snapshot,
    routines: [{ id: 'rtn_1', name: 'Push', items: [{ ...base, ...patch }] }],
  }) as WatchRoutinesDocument;

const decode = Schema.decodeUnknownEither(WatchRoutinesDocumentSchema);

describe('encodeWatchRoutines', () => {
  it('writes every item with its tracking type and every set with its own type and values, in wire order', () => {
    expect(encodeWatchRoutines(snapshot)).toBe(WIRE_JSON);
    expect(encodeWatchRoutines(snapshot)).toBe(JSON.stringify(snapshot));
  });

  it('reads back what it wrote', () => {
    expect(Schema.decodeUnknownSync(Schema.parseJson(WatchRoutinesDocumentSchema))(WIRE_JSON)).toEqual(snapshot);
  });

  it('refuses a snapshot the watch would reject', () => {
    const set = { type: 'weightReps' as const, reps: 8, weightKg: 60, targetRpe: null };
    const timed = plank.sets[0];
    for (const bad of [
      withItem({ sets: [{ ...set, weightKg: ITEM_BOUNDS.weightKg.max + 1 }] }),
      withItem({ sets: [{ ...set, reps: 0 }] }),
      withItem({ sets: [{ ...set, reps: ITEM_BOUNDS.reps.max + 1 }] }),
      withItem({ sets: [{ ...set, reps: 7.5 }] }),
      withItem({ sets: [{ ...set, targetRpe: ITEM_BOUNDS.rpe.max + 0.5 }] }),
      withItem({ sets: [] }),
      withItem({ sets: Array.from({ length: ITEM_BOUNDS.sets.max + 1 }, () => set) }),
      withItem({ sets: [{ ...timed, durationSeconds: ITEM_BOUNDS.durationSeconds.min - 1 }] }, plank),
      withItem({ sets: [{ ...timed, durationSeconds: ITEM_BOUNDS.durationSeconds.max + 1 }] }, plank),
      withItem({ sets: [{ ...timed, durationSeconds: 30.5 }] }, plank),
      withItem({ sets: [{ type: 'repsOnly', reps: 0, targetRpe: null }] }, pullUps),
      withItem({ sets: [set] }, pullUps),
      withItem({ sets: [{ type: 'repsOnly', reps: 8, targetRpe: null }] }),
      withItem({ trackingType: 'stretch' }),
    ]) {
      expect(() => encodeWatchRoutines(bad)).toThrow();
    }
  });

  it('refuses the v2 shape, where sets had no type and items no tracking type', () => {
    const v2Item = { ...item, trackingType: undefined, sets: [{ reps: 8, weightKg: 60, targetRpe: null }] };
    const v2 = { ...snapshot, routines: [{ id: 'rtn_1', name: 'Push', items: [v2Item] }] };
    expect(decode(v2)._tag).toBe('Left');
    expect(decode({ ...v2, version: 2 })._tag).toBe('Left');
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
