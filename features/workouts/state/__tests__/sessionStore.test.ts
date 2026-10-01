import { isSessionInProgress, resetAllStores } from '@/features/core/state';
import { anEntry, aSession } from '@/features/workouts/__fixtures__/builders';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

const NOW = 2_000_000_000_000;
const store = () => useSessionStore.getState();

beforeEach(() => resetAllStores());

describe('the session store at launch', () => {
  it('restores an active session and starts its clock from now', () => {
    store().hydrate(aSession(), NOW);

    expect(store()).toMatchObject({ hydrated: true, clockRunning: true, lastTickAt: NOW, persistFailed: false });
    expect(store().session).toEqual(aSession());
  });

  it('restores a paused session with its clock stopped', () => {
    store().hydrate(aSession({ status: 'paused' }), NOW);

    expect(store().clockRunning).toBe(false);
  });

  it('is hydrated with nothing to restore', () => {
    store().hydrate(null, NOW);

    expect(store()).toMatchObject({ hydrated: true, session: null, writes: 0 });
  });

  it('writes nothing for a restored session', () => {
    store().hydrate(aSession(), NOW);

    expect(store().writes).toBe(0);
  });
});

describe('the session store starting a workout', () => {
  it('takes the session, queues its first write and starts the clock', () => {
    store().start(aSession(), NOW);

    expect(store().pendingWrite).toEqual({ kind: 'save', session: aSession() });
    expect(store()).toMatchObject({ writes: 1, clockRunning: true, lastTickAt: NOW, hydrated: true });
  });

  it('tells the core a workout is in progress, and that it ended', () => {
    store().start(aSession(), NOW);
    const during = isSessionInProgress();

    store().ended(aSession().id);

    expect(during).toBe(true);
    expect(isSessionInProgress()).toBe(false);
  });

  it('clears a previous persistence failure', () => {
    store().markPersistFailed();

    store().start(aSession(), NOW);

    expect(store().persistFailed).toBe(false);
  });
});

describe('the session store editing a workout', () => {
  beforeEach(() => store().start(aSession(), NOW));

  it('pauses: stops the clock and queues the paused session', () => {
    store().pause(NOW + 1);

    expect(store().clockRunning).toBe(false);
    expect(store().pendingWrite).toEqual({ kind: 'save', session: aSession({ status: 'paused', updatedAt: NOW + 1 }) });
  });

  it('resumes: restarts the clock from now', () => {
    store().pause(NOW + 1);

    store().resume(NOW + 5_000);

    expect(store()).toMatchObject({ clockRunning: true, lastTickAt: NOW + 5_000 });
    expect(store().session?.status).toBe('active');
  });

  it('hands back the rest to start when a set is completed, and queues the change', () => {
    const rest = store().toggleSet(1, 0, NOW + 1);

    expect(rest).toBe(60);
    expect(store().writes).toBe(2);
    expect(store().session?.entries[1]?.sets[0]?.completed).toBe(true);
  });

  it('queues nothing for a change that does not apply', () => {
    store().removeSet(0, 5, NOW + 1);
    store().removeSet(0, 0, NOW + 1);
    const writes = store().writes;

    store().resume(NOW + 2);
    store().toggleSet(9, 0, NOW + 2);

    expect(store().writes).toBe(writes);
  });

  it('queues only the rest being cleared when a rest is skipped', () => {
    store().setRest(90, 0, NOW + 1);

    store().clearRest(NOW + 2);

    expect(store().pendingWrite).toEqual({ kind: 'clearRest', sessionId: aSession().id });
    expect(store().session?.restEndsAt).toBeNull();
    expect(store().restEntryIndex).toBeNull();
  });

  it('keeps the exercise a rest follows as the list closes up, and drops it with that exercise', () => {
    store().addExercise(anEntry({ exerciseId: 'ex:pullups' }), NOW + 1);
    store().setRest(90, 2, NOW + 2);

    store().removeExercise(0, NOW + 3);
    const followed = store().restEntryIndex;
    store().removeExercise(1, NOW + 4);

    expect(followed).toBe(1);
    expect(store().restEntryIndex).toBeNull();
  });

  it('adds an exercise at the end of the list', () => {
    store().addExercise(anEntry({ exerciseId: 'ex:pullups' }), NOW + 1);

    expect(store().session?.entries.map(entry => entry.exerciseId)).toEqual([
      'ex:barbell-bench-press',
      'ex:barbell-squat',
      'ex:pullups',
    ]);
  });
});

describe('the session store clock', () => {
  beforeEach(() => store().start(aSession({ elapsedSeconds: 0 }), NOW));

  it('banks each tick and counts it, without a write', () => {
    store().tickClock(NOW + 1_000);
    store().tickClock(NOW + 2_000);

    expect(store()).toMatchObject({ tick: 2, lastTickAt: NOW + 2_000, writes: 1 });
    expect(store().session?.elapsedSeconds).toBe(2);
  });

  it('banks nothing while paused', () => {
    store().pause(NOW);

    store().tickClock(NOW + 1_000);

    expect(store().session?.elapsedSeconds).toBe(0);
  });

  it('stops and writes the session when the app leaves the front', () => {
    store().tickClock(NOW + 1_000);

    store().appStateChanged('background', NOW + 1_500);

    expect(store().clockRunning).toBe(false);
    expect(store().pendingWrite).toEqual({ kind: 'save', session: store().session });
  });

  it('banks the whole time away once on return, says how long it was, and writes it', () => {
    store().tickClock(NOW + 1_000);
    store().appStateChanged('background', NOW + 1_500);

    store().appStateChanged('active', NOW + 121_000);

    expect(store().session?.elapsedSeconds).toBe(121);
    expect(store()).toMatchObject({ awayNoticeSeconds: 120, clockRunning: true, lastTickAt: NOW + 121_000 });
    expect(store().pendingWrite).toEqual({ kind: 'save', session: store().session });
  });

  it('banks nothing on return to a paused workout', () => {
    store().pause(NOW);
    store().appStateChanged('background', NOW);

    store().appStateChanged('active', NOW + 60_000);

    expect(store().session?.elapsedSeconds).toBe(0);
    expect(store().clockRunning).toBe(false);
  });
});

describe('the session store ending a workout', () => {
  beforeEach(() => store().start(aSession(), NOW));

  it('stops the clock when the finish begins, keeping the session', () => {
    store().beginFinish();

    expect(store().clockRunning).toBe(false);
    expect(store().session).not.toBeNull();
  });

  it('says a finish is under way until it fails, so the live workout knows it is leaving', () => {
    store().beginFinish();
    const during = store().finishing;
    store().ended(aSession().id);
    const after = store().finishing;
    store().finishFailed();

    expect([during, after, store().finishing]).toEqual([true, true, false]);
  });

  it('starts the next workout with no finish under way', () => {
    store().beginFinish();
    store().start(aSession(), NOW);

    expect(store().finishing).toBe(false);
  });

  it('lets the session go once it was recorded or discarded', () => {
    store().markPersistFailed();

    store().ended(aSession().id);

    expect(store()).toMatchObject({ session: null, persistFailed: false, clockRunning: false });
  });

  it('starts the next workout without the away notice of the one before', () => {
    store().appStateChanged('background', NOW);
    store().appStateChanged('active', NOW + 180_000);
    const away = store().awayNoticeSeconds;

    store().ended(aSession().id);
    const afterEnd = store().awayNoticeSeconds;
    store().start(aSession({ id: ActivityId.make('session-next') }), NOW + 200_000);

    expect([away, afterEnd, store().awayNoticeSeconds]).toEqual([180, 0, 0]);
  });

  it('clears the away notice when a workout starts over one that never ended', () => {
    store().appStateChanged('background', NOW);
    store().appStateChanged('active', NOW + 180_000);

    store().start(aSession({ id: ActivityId.make('session-next') }), NOW + 200_000);

    expect(store().awayNoticeSeconds).toBe(0);
  });

  it('keeps the session when another one ended', () => {
    store().ended('session-other');

    expect(store().session).not.toBeNull();
  });
});
