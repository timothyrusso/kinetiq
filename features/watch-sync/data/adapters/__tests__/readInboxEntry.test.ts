import { anInboxEntry, aWatchDocument, UUID } from '@/features/watch-sync/__fixtures__/watchWorkout';
import { readInboxEntry } from '@/features/watch-sync/data/adapters/readInboxEntry';

const aSet = { type: 'weightReps', index: 0, reps: 5, weightKg: 80, completed: true, rpe: null };

const anEntry = (fields: Record<string, unknown>) => ({
  exerciseId: 'ex:barbell-bench-press',
  exerciseName: 'Bench',
  trackingType: 'weightReps',
  restSeconds: 60,
  notes: null,
  sets: [aSet],
  ...fields,
});

const workoutOf = (entry: ReturnType<typeof anInboxEntry>) => {
  const { read } = readInboxEntry(entry);
  if (!read.ok) throw new Error(`expected a workout, got ${read.reason}`);
  return read.workout;
};

describe('readInboxEntry', () => {
  it('keeps the entry id, so the drain acks the file it read', () => {
    expect(readInboxEntry(anInboxEntry(aWatchDocument(), { id: 'file-1' })).id).toBe('file-1');
  });

  it('records a watch workout under a watch- activity id with its routine', () => {
    const workout = workoutOf(anInboxEntry());

    expect(workout.id).toBe(`watch-${UUID}`);
    expect(workout.routineId).toBe('rtn_1');
  });

  it('computes the duration from the wall clock', () => {
    const workout = workoutOf(anInboxEntry());

    expect(workout.durationSeconds).toBe(45 * 60);
  });

  it('counts only the completed sets in the totals and estimates their one-rep max', () => {
    const workout = workoutOf(anInboxEntry());

    expect(workout.totalSets).toBe(1);
    expect(workout.totalVolumeKg).toBe(400);
    const [entry] = workout.entries;
    expect(entry?.trackingType === 'weightReps' ? entry.sets.map(set => set.estimated1rm) : []).toEqual([93.5, null]);
    expect(workout.entries[0]?.muscleGroup).toBeNull();
  });

  it('accepts null fields and an exercise the phone may no longer have', () => {
    const workout = workoutOf(
      anInboxEntry(
        aWatchDocument({
          routineId: null,
          entries: [anEntry({ exerciseId: 'local:deleted', exerciseName: 'Gone', restSeconds: 0 })],
        }),
      ),
    );

    expect(workout.routineId).toBeNull();
    expect(workout.entries[0]?.sets[0]?.rpe).toBeNull();
  });

  it('records a reps-only set with its reps, and no load, volume or one-rep max', () => {
    const workout = workoutOf(
      anInboxEntry(
        aWatchDocument({
          entries: [
            anEntry({
              exerciseId: 'ex:pullups',
              trackingType: 'repsOnly',
              sets: [
                { type: 'repsOnly', index: 0, reps: 12, completed: true, rpe: 8 },
                { type: 'repsOnly', index: 1, reps: 10, completed: false, rpe: null },
              ],
            }),
          ],
        }),
      ),
    );

    expect(workout.entries[0]).toMatchObject({
      trackingType: 'repsOnly',
      sets: [
        { type: 'repsOnly', index: 0, reps: 12, completed: true, rpe: 8 },
        { type: 'repsOnly', index: 1, reps: 10, completed: false, rpe: null },
      ],
    });
    expect(workout.entries[0]?.sets[0]).not.toHaveProperty('weightKg');
    expect(workout.entries[0]?.sets[0]).not.toHaveProperty('estimated1rm');
    expect(workout.totalSets).toBe(1);
    expect(workout.totalVolumeKg).toBe(0);
  });

  it('records a timed set with its seconds, and no reps, volume or one-rep max', () => {
    const workout = workoutOf(
      anInboxEntry(
        aWatchDocument({
          entries: [
            anEntry({
              exerciseId: 'ex:plank',
              trackingType: 'duration',
              sets: [{ type: 'duration', index: 0, durationSeconds: 45, completed: true, rpe: null }],
            }),
          ],
        }),
      ),
    );

    expect(workout.entries[0]).toMatchObject({
      trackingType: 'duration',
      sets: [{ type: 'duration', index: 0, durationSeconds: 45, completed: true, rpe: null }],
    });
    expect(workout.entries[0]?.sets[0]).not.toHaveProperty('reps');
    expect(workout.totalSets).toBe(1);
    expect(workout.totalVolumeKg).toBe(0);
  });

  it('reads a document from a newer watch app as version, apart from bad data', () => {
    expect(readInboxEntry(anInboxEntry(aWatchDocument(), { version: 4 })).read).toEqual({
      ok: false,
      reason: 'version',
    });
  });

  it('reads a v1 or v2 document as outdated: the phone no longer guesses a tracking type', () => {
    for (const version of [1, 2]) {
      expect(readInboxEntry(anInboxEntry(aWatchDocument({ version }), { version })).read).toEqual({
        ok: false,
        reason: 'outdated',
      });
    }
  });

  it('reads an unparseable payload as invalid', () => {
    expect(readInboxEntry(anInboxEntry('{"format": "kinetiq.watch-workout", "vers')).read).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('reads a set out of bounds as invalid, so nothing of it is saved', () => {
    const entry = anInboxEntry(
      aWatchDocument({
        entries: [anEntry({ sets: [{ ...aSet, weightKg: 451 }] })],
      }),
    );

    expect(readInboxEntry(entry).read).toEqual({ ok: false, reason: 'invalid' });
  });
});
