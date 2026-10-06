import {
  aDurationEntry,
  aDurationSet,
  anEntry,
  anOpenSet,
  aRepsOnlyEntry,
  aRepsOnlySet,
  aSession,
  aSet,
} from '@/features/workouts/__fixtures__/builders';
import {
  addSet,
  changeTrackingType,
  skipExercise,
  toggleSet,
  updateSet,
} from '@/features/workouts/domain/utils/sessionTransitions';
import { entryAs, entryOf, fieldsOf, isTypeLocked, newSet, setAs } from '@/features/workouts/domain/utils/trackingSets';

const NOW = 2_000_000_000_000;

/** A bench press with nothing done yet: two open sets of 5 at 100 kg, the first planned from row 0. */
const openBench = () =>
  anEntry({
    routineItemId: 'rit_bench',
    sets: [anOpenSet({ routineSetIndex: 0, rpe: 8 }), anOpenSet({ index: 1 })],
  });

describe('newSet', () => {
  it('opens each type on its own defaults: 8 reps at bodyweight, 8 reps, or 30 s', () => {
    expect(newSet('weightReps', 2)).toEqual({
      type: 'weightReps',
      index: 2,
      reps: 8,
      weightKg: 0,
      completed: false,
      estimated1rm: null,
      rpe: null,
    });
    expect(newSet('repsOnly', 0)).toEqual({ type: 'repsOnly', index: 0, reps: 8, completed: false, rpe: null });
    expect(newSet('duration', 0)).toEqual({
      type: 'duration',
      index: 0,
      durationSeconds: 30,
      completed: false,
      rpe: null,
    });
  });
});

describe('setAs', () => {
  it('carries the reps from weight and reps to reps only and drops the weight', () => {
    expect(setAs(anOpenSet({ reps: 12, weightKg: 60, rpe: 7, routineSetIndex: 1 }), 'repsOnly')).toEqual({
      type: 'repsOnly',
      index: 0,
      reps: 12,
      completed: false,
      rpe: 7,
      routineSetIndex: 1,
    });
  });

  it('carries the reps from reps only to weight and reps, at bodyweight', () => {
    expect(setAs(aRepsOnlySet({ reps: 15, completed: false }), 'weightReps')).toEqual({
      type: 'weightReps',
      index: 0,
      reps: 15,
      weightKg: 0,
      completed: false,
      estimated1rm: null,
      rpe: null,
    });
  });

  it('opens a set changing to a timed one on 30 s, and one changing from it on 8 reps', () => {
    expect(setAs(anOpenSet({ reps: 3, routineSetIndex: 0 }), 'duration')).toEqual({
      type: 'duration',
      index: 0,
      durationSeconds: 30,
      completed: false,
      rpe: null,
      routineSetIndex: 0,
    });
    expect(setAs(aDurationSet({ durationSeconds: 300, completed: false }), 'repsOnly')).toMatchObject({
      type: 'repsOnly',
      reps: 8,
    });
    expect(setAs(aDurationSet({ completed: false }), 'weightReps')).toMatchObject({
      type: 'weightReps',
      reps: 8,
      weightKg: 0,
    });
  });

  it('returns a set already of the type as it is', () => {
    const set = aSet();

    expect(setAs(set, 'weightReps')).toBe(set);
  });
});

describe('entryOf and entryAs', () => {
  it('builds an entry of the type from its fields, leaving out a set of another type', () => {
    const entry = entryOf(fieldsOf(anEntry()), 'repsOnly', [aRepsOnlySet(), aSet(), aDurationSet()]);

    expect(entry).toEqual(
      aRepsOnlyEntry({ exerciseId: 'ex:barbell-bench-press', exerciseName: 'Bench Press', sets: [aRepsOnlySet()] }),
    );
  });

  it('carries every set over and keeps the routine item', () => {
    const entry = entryAs(openBench(), 'repsOnly');

    expect(entry.trackingType).toBe('repsOnly');
    expect(entry.routineItemId).toBe('rit_bench');
    expect(entry.sets).toEqual([
      { type: 'repsOnly', index: 0, reps: 5, completed: false, rpe: 8, routineSetIndex: 0 },
      { type: 'repsOnly', index: 1, reps: 5, completed: false, rpe: null },
    ]);
  });

  it('returns an entry already of the type as it is', () => {
    const entry = aDurationEntry();

    expect(entryAs(entry, 'duration')).toBe(entry);
  });
});

describe('isTypeLocked', () => {
  it('locks once a set is completed, and not before', () => {
    expect(isTypeLocked(openBench())).toBe(false);
    expect(isTypeLocked(anEntry())).toBe(true);
  });
});

describe('changeTrackingType', () => {
  it('changes the type of an exercise with nothing done, and stamps the session', () => {
    const session = aSession({ entries: [openBench()] });

    const next = changeTrackingType(session, 0, 'duration', NOW);

    expect(next.updatedAt).toBe(NOW);
    expect(next.entries[0]).toMatchObject({ trackingType: 'duration', routineItemId: 'rit_bench' });
    expect(next.entries[0]?.sets).toEqual([
      { type: 'duration', index: 0, durationSeconds: 30, completed: false, rpe: 8, routineSetIndex: 0 },
      { type: 'duration', index: 1, durationSeconds: 30, completed: false, rpe: null },
    ]);
  });

  it('locks the type once a set of the exercise is completed', () => {
    const session = aSession({ entries: [anEntry()] });

    expect(changeTrackingType(session, 0, 'repsOnly', NOW)).toBe(session);
  });

  it('unlocks again when the completed set is unticked', () => {
    const ticked = toggleSet(aSession({ entries: [openBench()] }), 0, 0, NOW).session;
    expect(changeTrackingType(ticked, 0, 'repsOnly', NOW)).toBe(ticked);

    const unticked = toggleSet(ticked, 0, 0, NOW).session;
    expect(changeTrackingType(unticked, 0, 'repsOnly', NOW).entries[0]?.trackingType).toBe('repsOnly');
  });

  it('changes nothing for the same type or an exercise that is not there', () => {
    const session = aSession({ entries: [openBench()] });

    expect(changeTrackingType(session, 0, 'weightReps', NOW)).toBe(session);
    expect(changeTrackingType(session, 5, 'duration', NOW)).toBe(session);
  });

  it('leaves the other exercises alone', () => {
    const other = aRepsOnlyEntry();
    const session = aSession({ entries: [openBench(), other] });

    expect(changeTrackingType(session, 0, 'repsOnly', NOW).entries[1]).toBe(other);
  });
});

describe('the transitions on each type', () => {
  it('change only the fields a set’s type records', () => {
    const session = aSession({
      entries: [aRepsOnlyEntry({ sets: [aRepsOnlySet({ completed: false })] }), aDurationEntry()],
    });

    const reps = updateSet(session, 0, 0, { reps: 20, weightKg: 50, durationSeconds: 90, rpe: 9 }, NOW);
    const timed = updateSet(reps, 1, 0, { reps: 20, durationSeconds: 90 }, NOW);

    expect(timed.entries[0]?.sets[0]).toEqual({ type: 'repsOnly', index: 0, reps: 20, completed: false, rpe: 9 });
    expect(timed.entries[1]?.sets[0]).toEqual({
      type: 'duration',
      index: 0,
      durationSeconds: 90,
      completed: true,
      rpe: null,
    });
  });

  it('clears the RPE when the patch says null, and keeps it when the patch says nothing', () => {
    const session = aSession({ entries: [aRepsOnlyEntry({ sets: [aRepsOnlySet({ rpe: 7 })] })] });

    expect(updateSet(session, 0, 0, { reps: 3 }, NOW).entries[0]?.sets[0]?.rpe).toBe(7);
    expect(updateSet(session, 0, 0, { rpe: null }, NOW).entries[0]?.sets[0]?.rpe).toBeNull();
  });

  it('add a set like the last one, of its type', () => {
    const session = aSession({ entries: [aDurationEntry({ sets: [aDurationSet({ durationSeconds: 75, rpe: 6 })] })] });

    expect(addSet(session, 0, NOW).entries[0]?.sets[1]).toEqual({
      type: 'duration',
      index: 1,
      durationSeconds: 75,
      completed: false,
      rpe: null,
    });
  });

  it('open an empty exercise on its type’s defaults', () => {
    const session = aSession({ entries: [aRepsOnlyEntry({ sets: [] }), aDurationEntry({ sets: [] })] });

    const next = addSet(addSet(session, 0, NOW), 1, NOW);

    expect(next.entries[0]?.sets).toEqual([newSet('repsOnly', 0)]);
    expect(next.entries[1]?.sets).toEqual([newSet('duration', 0)]);
  });

  it('tick a timed set and hand back the rest, with no estimate', () => {
    const session = aSession({ entries: [aDurationEntry({ sets: [aDurationSet({ completed: false })] })] });

    const { session: next, restSeconds } = toggleSet(session, 0, 0, NOW);

    expect(restSeconds).toBe(60);
    expect(next.entries[0]?.sets[0]).toEqual(aDurationSet());
  });

  it('untick every set of a skipped reps-only exercise', () => {
    const next = skipExercise(aSession({ entries: [aRepsOnlyEntry(), anEntry()] }), 0, NOW);

    expect(next.entries[0]?.trackingType).toBe('repsOnly');
    expect(next.entries[0]?.sets.every(set => !set.completed)).toBe(true);
  });
});
