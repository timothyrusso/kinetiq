import { anInboxEntry, aWatchDocument, UUID } from '@/features/watch-sync/__fixtures__/watchWorkout';
import { readInboxEntry } from '@/features/watch-sync/data/adapters/readInboxEntry';

const aSet = { index: 0, reps: 5, weightKg: 80, completed: true, rpe: null };

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
          entries: [{ exerciseId: 'local:deleted', exerciseName: 'Gone', restSeconds: 0, notes: null, sets: [aSet] }],
        }),
      ),
    );

    expect(workout.routineId).toBeNull();
    expect(workout.entries[0]?.sets[0]?.rpe).toBeNull();
  });

  it('still saves a v1 workout from a watch app not yet updated', () => {
    const workout = workoutOf(anInboxEntry(aWatchDocument({ version: 1 }), { version: 1 }));

    expect(workout.id).toBe(`watch-${UUID}`);
    expect(workout.totalSets).toBe(1);
  });

  it('reads a document from a newer watch app as version, apart from bad data', () => {
    expect(readInboxEntry(anInboxEntry(aWatchDocument(), { version: 3 })).read).toEqual({
      ok: false,
      reason: 'version',
    });
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
        entries: [
          {
            exerciseId: 'ex:barbell-bench-press',
            exerciseName: 'Bench',
            restSeconds: 60,
            notes: null,
            sets: [{ ...aSet, weightKg: 451 }],
          },
        ],
      }),
    );

    expect(readInboxEntry(entry).read).toEqual({ ok: false, reason: 'invalid' });
  });
});
