import { anEntry, anOpenSet, anotherEntry, aSession, aSet } from '@/features/workouts/__fixtures__/builders';
import {
  addExercise,
  addSet,
  bankElapsed,
  clearRest,
  focusExercise,
  pauseSession,
  removeExercise,
  removeSet,
  resumeSession,
  secondsBetween,
  skipExercise,
  startRest,
  tickElapsed,
  toggleSet,
  updateSet,
} from '@/features/workouts/domain/utils/sessionTransitions';

const NOW = 2_000_000_000_000;

describe('pauseSession and resumeSession', () => {
  it('pauses an active session and stamps it', () => {
    expect(pauseSession(aSession(), NOW)).toMatchObject({ status: 'paused', updatedAt: NOW });
  });

  it('leaves a paused session as it is when asked to pause', () => {
    const paused = aSession({ status: 'paused' });

    expect(pauseSession(paused, NOW)).toBe(paused);
  });

  it('resumes a paused session', () => {
    expect(resumeSession(aSession({ status: 'paused' }), NOW)).toMatchObject({ status: 'active', updatedAt: NOW });
  });

  it('leaves an active session as it is when asked to resume', () => {
    const active = aSession();

    expect(resumeSession(active, NOW)).toBe(active);
  });
});

describe('startRest and clearRest', () => {
  it('stores the rest as a deadline from now, rounded to the second', () => {
    expect(startRest(aSession(), 89.6, NOW)).toMatchObject({ restEndsAt: NOW + 90_000, restDurationSeconds: 90 });
  });

  it('holds a rest for at least five seconds', () => {
    expect(startRest(aSession(), 2, NOW)).toMatchObject({ restEndsAt: NOW + 5_000, restDurationSeconds: 5 });
  });

  it('clears the rest when given no length', () => {
    const resting = aSession({ restEndsAt: NOW + 30_000, restDurationSeconds: 90 });

    expect(startRest(resting, null, NOW)).toMatchObject({ restEndsAt: null, restDurationSeconds: null });
  });

  it('clears a rest in progress', () => {
    const resting = aSession({ restEndsAt: NOW + 30_000, restDurationSeconds: 90 });

    expect(clearRest(resting, NOW)).toMatchObject({ restEndsAt: null, restDurationSeconds: null, updatedAt: NOW });
  });
});

describe('focusExercise', () => {
  it('makes an exercise the current one', () => {
    expect(focusExercise(aSession(), 1, NOW).activeIndex).toBe(1);
  });

  it('clamps an index past the end to the last exercise', () => {
    expect(focusExercise(aSession(), 7, NOW).activeIndex).toBe(1);
  });
});

describe('toggleSet', () => {
  it('completes an open set, writes its estimate and hands back the rest to start', () => {
    const { session, restSeconds } = toggleSet(aSession(), 1, 0, NOW);

    expect(session.entries[1]?.sets[0]).toMatchObject({ completed: true, estimated1rm: 50.5 });
    expect(restSeconds).toBe(60);
  });

  it('unticks a completed set and starts no rest', () => {
    const { session, restSeconds } = toggleSet(aSession(), 0, 0, NOW);

    expect(session.entries[0]?.sets[0]?.completed).toBe(false);
    expect(restSeconds).toBeNull();
  });

  it('changes nothing for an exercise that is not there', () => {
    const current = aSession();

    expect(toggleSet(current, 5, 0, NOW)).toEqual({ session: current, restSeconds: null });
  });
});

describe('updateSet', () => {
  it('changes the set and refreshes the estimate of a completed one', () => {
    const next = updateSet(aSession(), 0, 1, { reps: 1, weightKg: 130 }, NOW);

    expect(next.entries[0]?.sets[1]).toMatchObject({ reps: 1, weightKg: 130, estimated1rm: 130 });
  });

  it('changes nothing for an exercise that is not there', () => {
    const current = aSession();

    expect(updateSet(current, 5, 0, { reps: 3 }, NOW)).toBe(current);
  });
});

describe('addSet', () => {
  it('appends an open set with the previous set’s targets', () => {
    const next = addSet(aSession(), 1, NOW);

    expect(next.entries[1]?.sets).toHaveLength(4);
    expect(next.entries[1]?.sets[3]).toEqual(anOpenSet({ index: 3, reps: 8, weightKg: 40 }));
  });

  it('opens an empty exercise on eight reps at bodyweight', () => {
    const empty = aSession({ entries: [anEntry({ sets: [] })] });

    expect(addSet(empty, 0, NOW).entries[0]?.sets).toEqual([anOpenSet({ index: 0, reps: 8, weightKg: 0 })]);
  });
});

describe('removeSet', () => {
  it('removes the set and numbers the rest from 0', () => {
    const next = removeSet(aSession(), 1, 0, NOW);

    expect(next.entries[1]?.sets.map(set => set.index)).toEqual([0, 1]);
  });

  it('keeps an exercise’s last set', () => {
    const single = aSession({ entries: [anEntry({ sets: [aSet()] })] });

    expect(removeSet(single, 0, 0, NOW)).toBe(single);
  });
});

describe('skipExercise', () => {
  it('unticks every set, keeps the cue and moves on to the next exercise', () => {
    const next = skipExercise(aSession(), 0, NOW);

    expect(next.entries[0]?.sets.every(set => !set.completed)).toBe(true);
    expect(next.activeIndex).toBe(1);
  });

  it('stays on the last exercise when skipping it', () => {
    const next = skipExercise(aSession({ entries: [anotherEntry()] }), 0, NOW);

    expect(next.entries[0]?.notes).toBe('Brace first');
    expect(next.activeIndex).toBe(0);
  });
});

describe('removeExercise and addExercise', () => {
  it('removes an exercise and keeps the pointer in the list', () => {
    const next = removeExercise(aSession({ activeIndex: 1 }), 1, NOW);

    expect(next.entries.map(entry => entry.exerciseName)).toEqual(['Bench Press']);
    expect(next.activeIndex).toBe(0);
  });

  it('keeps a session’s last exercise', () => {
    const single = aSession({ entries: [anEntry()] });

    expect(removeExercise(single, 0, NOW)).toBe(single);
  });

  it('appends an exercise', () => {
    const next = addExercise(aSession({ entries: [] }), anEntry(), NOW);

    expect(next.entries).toEqual([anEntry()]);
  });
});

describe('the clock', () => {
  it('banks a tick without stamping the session', () => {
    const ticked = tickElapsed(aSession(), 1);

    expect(ticked.elapsedSeconds).toBe(601);
    expect(ticked.updatedAt).toBe(aSession().updatedAt);
  });

  it('banks a return from the background and stamps it', () => {
    expect(bankElapsed(aSession(), 120, NOW)).toMatchObject({ elapsedSeconds: 720, updatedAt: NOW });
  });

  it('counts whole seconds between two readings, never negative', () => {
    expect(secondsBetween(1_000, 2_600)).toBe(2);
    expect(secondsBetween(5_000, 1_000)).toBe(0);
  });
});
