import { anInboxEntry, aWatchDocument, UUID } from '@/features/watch-sync/__fixtures__/watchWorkout';
import { readInboxEntry } from '@/features/watch-sync/data/adapters/readInboxEntry';
import { estimateCalories } from '@/features/workouts';

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

  it('computes the duration from the wall clock and the calories as a phone session does', () => {
    const workout = workoutOf(anInboxEntry());

    expect(workout.durationSeconds).toBe(45 * 60);
    expect(workout.caloriesKcal).toBe(estimateCalories(45 * 60));
  });

  it('counts only the completed sets in the totals and estimates their one-rep max', () => {
    const workout = workoutOf(anInboxEntry());

    expect(workout.totalSets).toBe(1);
    expect(workout.totalVolumeKg).toBe(400);
    expect(workout.entries[0]?.sets.map(set => set.estimated1rm)).toEqual([93.5, null]);
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

  it('reads a document from a newer watch app as version, apart from bad data', () => {
    expect(readInboxEntry(anInboxEntry(aWatchDocument(), { version: 2 })).read).toEqual({
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
            exerciseId: 'wger:73',
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
