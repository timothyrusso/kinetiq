import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { anEntry, aSession } from '@/features/workouts/__fixtures__/builders';
import {
  sessionActions,
  sessionLifecycle,
  useActiveSession,
  useRunningWorkoutName,
} from '@/features/workouts/facades/useActiveSession';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

const live = () => useSessionStore.getState().session;

beforeEach(() => {
  resetAllStores();
  sessionLifecycle.restore(aSession());
});

describe('sessionActions', () => {
  it('pauses the workout', () => {
    sessionActions.pause();

    expect(live()?.status).toBe('paused');
  });

  it('resumes a paused workout', () => {
    sessionActions.pause();

    sessionActions.resume();

    expect(live()?.status).toBe('active');
  });

  it('starts a rest of the given length', () => {
    sessionActions.setRest(90, 0);

    expect(live()?.restDurationSeconds).toBe(90);
  });

  it('clears a rest', () => {
    sessionActions.setRest(90, 0);

    sessionActions.clearRest();

    expect(live()?.restEndsAt).toBeNull();
  });

  it('makes another exercise the current one', () => {
    sessionActions.focus(1);

    expect(live()?.activeIndex).toBe(1);
  });

  it('ticks an open set and hands back the rest to start', () => {
    const rest = sessionActions.toggleSet(1, 0);

    expect(rest).toBe(60);
    expect(live()?.entries[1]?.sets[0]?.completed).toBe(true);
  });

  it('changes a set', () => {
    sessionActions.updateSet(0, 0, { reps: 3 });

    expect(live()?.entries[0]?.sets[0]?.reps).toBe(3);
  });

  it('adds a set like the last one', () => {
    sessionActions.addSet(0);

    expect(live()?.entries[0]?.sets[2]).toMatchObject({ index: 2, reps: 5, weightKg: 100, completed: false });
  });

  it('removes a set', () => {
    sessionActions.removeSet(0, 0);

    expect(live()?.entries[0]?.sets).toHaveLength(1);
  });

  it('skips an exercise, unticking its sets and moving on', () => {
    sessionActions.skipExercise(0);

    expect(live()?.entries[0]?.sets.every(set => !set.completed)).toBe(true);
    expect(live()?.activeIndex).toBe(1);
  });

  it('removes an exercise', () => {
    sessionActions.removeExercise(0);

    expect(live()?.entries.map(entry => entry.exerciseName)).toEqual(['Overhead Press']);
  });

  it('adds an exercise at the end', () => {
    sessionActions.addExercise(anEntry({ exerciseId: 'wger:99', exerciseName: 'Dips' }));

    expect(live()?.entries.at(-1)?.exerciseName).toBe('Dips');
  });
});

describe('sessionLifecycle', () => {
  it('pauses a restored workout', () => {
    sessionLifecycle.pause();

    expect(live()?.status).toBe('paused');
  });

  it('stops the clock while the app is away', () => {
    sessionLifecycle.appStateChanged('background');

    expect(useSessionStore.getState().clockRunning).toBe(false);
  });
});

describe('useRunningWorkoutName', () => {
  it('names the workout in progress', async () => {
    const { result } = await renderHook(useRunningWorkoutName);

    expect(result.current).toBe('Push Day');
  });

  it('is null once the workout has ended', async () => {
    const { result } = await renderHook(useRunningWorkoutName);

    await act(async () => useSessionStore.getState().ended(aSession().id));

    expect(result.current).toBeNull();
  });
});

describe('useActiveSession', () => {
  it('publishes the restored workout, restored and saving', async () => {
    const { result } = await renderHook(useActiveSession);

    expect(result.current).toMatchObject({ hydrated: true, persistFailed: false, awayNoticeSeconds: 0 });
    expect(result.current.session?.id).toBe(aSession().id);
  });
});
