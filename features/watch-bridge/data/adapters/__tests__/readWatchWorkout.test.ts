import { document, entry, UUID } from '@/features/watch-bridge/data/adapters/__tests__/fixtures';
import { readWatchWorkout } from '@/features/watch-bridge/data/adapters/readWatchWorkout';

const withSet = (set: Record<string, unknown>, trackingType = 'weightReps') =>
  document({
    entries: [
      {
        exerciseId: 'ex:barbell-bench-press',
        exerciseName: 'Bench',
        trackingType,
        restSeconds: 60,
        notes: null,
        sets: [set],
      },
    ],
  });
const set = { type: 'weightReps', index: 0, reps: 5, weightKg: 80, completed: true, rpe: null };
const withEntry = {
  exerciseId: 'x',
  exerciseName: 'X',
  trackingType: 'weightReps',
  restSeconds: 60,
  notes: null,
  sets: [set],
};
const repsOnlySet = { type: 'repsOnly', index: 0, reps: 12, completed: true, rpe: null };
const durationSet = { type: 'duration', index: 0, durationSeconds: 45, completed: true, rpe: null };

describe('readWatchWorkout', () => {
  it('decodes the valid fixture to the document it encodes', () => {
    expect(readWatchWorkout(entry())).toEqual({ ok: true, document: document() });
  });

  it('reads absent nullable fields as null, and accepts an exercise the phone may no longer have', () => {
    const {
      routineId: _routineId,
      notes: _notes,
      ...rest
    } = document({
      entries: [
        {
          exerciseId: 'local:deleted',
          exerciseName: 'Gone',
          trackingType: 'weightReps',
          restSeconds: 0,
          sets: [{ ...set, rpe: undefined }],
        },
      ],
    });
    const read = readWatchWorkout(entry(rest));
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.document.routineId).toBeNull();
      expect(read.document.notes).toBeNull();
      expect(read.document.entries[0]?.notes).toBeNull();
      expect(read.document.entries[0]?.sets[0]?.rpe).toBeNull();
    }
  });

  it('reads each tracking type, every set carrying its own type', () => {
    const read = readWatchWorkout(entry());
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.document.entries.map(e => e.trackingType)).toEqual(['weightReps', 'repsOnly', 'duration']);
      expect(read.document.entries[2]?.sets[0]).toEqual(durationSet);
    }
    expect(readWatchWorkout(entry(withSet(repsOnlySet, 'repsOnly'))).ok).toBe(true);
    expect(readWatchWorkout(entry(withSet(durationSet, 'duration'))).ok).toBe(true);
  });

  it("rejects a set whose type is not its entry's, or that misses its type's value", () => {
    for (const [bad, trackingType] of [
      [repsOnlySet, 'weightReps'],
      [set, 'duration'],
      [durationSet, 'repsOnly'],
      [{ ...set, type: undefined }, 'weightReps'],
      [{ ...repsOnlySet, reps: undefined }, 'repsOnly'],
      [{ ...durationSet, durationSeconds: undefined }, 'duration'],
    ] as const) {
      expect(readWatchWorkout(entry(withSet(bad, trackingType)))).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(readWatchWorkout(entry(withSet(set, 'stretch')))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('tells an older workout apart from a newer one, in the envelope and in the document', () => {
    for (const older of [0, 1, 2]) {
      expect(readWatchWorkout(entry(document({ version: older }), { version: older }))).toEqual({
        ok: false,
        reason: 'outdated',
      });
    }
    expect(readWatchWorkout(entry(document({ version: 2, entries: 'old shape' })))).toEqual({
      ok: false,
      reason: 'outdated',
    });
    expect(readWatchWorkout(entry(document(), { version: 2 }))).toEqual({ ok: false, reason: 'outdated' });
    expect(readWatchWorkout(entry(document({ version: 'three' })))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('ignores a calories field a watch document may still carry', () => {
    const read = readWatchWorkout(entry({ ...document(), caloriesKcal: 300 }));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.document).not.toHaveProperty('caloriesKcal');
  });

  it('keeps an unknown version apart from bad data, in the envelope and in the document', () => {
    expect(readWatchWorkout(entry(document(), { version: 4 }))).toEqual({ ok: false, reason: 'version' });
    expect(readWatchWorkout(entry(document({ version: 4, entries: 'new shape' })))).toEqual({
      ok: false,
      reason: 'version',
    });
  });

  it('rejects out-of-bounds values', () => {
    for (const bad of [
      { ...set, weightKg: 451 },
      { ...set, weightKg: -1 },
      { ...set, reps: 101 },
      { ...set, reps: 2.5 },
      { ...set, completed: 'yes' },
      { ...set, rpe: 11 },
      { ...set, reps: undefined },
    ]) {
      expect(readWatchWorkout(entry(withSet(bad)))).toEqual({ ok: false, reason: 'invalid' });
    }
    const longRest = document({
      entries: [
        { exerciseId: 'x', exerciseName: 'X', trackingType: 'weightReps', restSeconds: 601, notes: null, sets: [set] },
      ],
    });
    expect(readWatchWorkout(entry(longRest)).ok).toBe(false);
    for (const seconds of [-1, 3601, 30.5]) {
      expect(readWatchWorkout(entry(withSet({ ...durationSet, durationSeconds: seconds }, 'duration'))).ok).toBe(false);
    }
    expect(readWatchWorkout(entry(withSet({ ...repsOnlySet, reps: 101 }, 'repsOnly'))).ok).toBe(false);
    expect(readWatchWorkout(entry(document({ endedAt: '2026-09-25T09:00:00.000Z' }))).ok).toBe(false);
    expect(readWatchWorkout(entry(document({ endedAt: '2026-09-27T10:00:00.000Z' }))).ok).toBe(false);
  });

  it('rejects garbage, a missing field, a bad id and another format', () => {
    expect(readWatchWorkout(entry('{"format": "kinetiq.watch-workout", "vers'))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(readWatchWorkout(entry('', {}))).toEqual({ ok: false, reason: 'invalid' });
    expect(readWatchWorkout(entry(document({ title: undefined }))).ok).toBe(false);
    expect(readWatchWorkout(entry(document({ id: '../../etc' }))).ok).toBe(false);
    expect(readWatchWorkout(entry(document(), { format: 'kinetiq.routines' }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(readWatchWorkout(entry('x'.repeat(1_000_001))).ok).toBe(false);
    expect(readWatchWorkout(entry(document({ format: 'kinetiq.routines' })))).toEqual({ ok: false, reason: 'invalid' });
    expect(readWatchWorkout(entry('[1, 2]'))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects an empty set list and a blank exercise id', () => {
    expect(readWatchWorkout(entry(document({ entries: [{ ...withEntry, exerciseId: 'x', sets: [] }] }))).ok).toBe(
      false,
    );
    expect(readWatchWorkout(entry(document({ entries: [{ ...withEntry, exerciseId: '' }] }))).ok).toBe(false);
  });

  it('carries the watch id through untouched', () => {
    const read = readWatchWorkout(entry());
    expect(read.ok && read.document.id).toBe(UUID);
  });
});
