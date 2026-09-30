import { act } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { anExercise, aSession, plannedSets } from '@/features/workouts/__fixtures__/builders';
import { refuseWrites, storedSnapshot } from '@/features/workouts/di/__tests__/workoutsTestData';
import { renderWithWorkouts } from '@/features/workouts/facades/__tests__/renderWithWorkouts';
import { sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useAddSessionExercise } from '@/features/workouts/facades/useAddSessionExercise';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import type { ExerciseTarget } from '@/features/workouts/useCases/addSessionExercise';

const DIPS = anExercise({ id: 'wger:99', externalId: 99, name: 'Dips' });
const TARGET: ExerciseTarget = { sets: plannedSets(3, 10, 0), restSeconds: 60, notes: null };

const live = () => useSessionStore.getState().session;

const renderAdd = async () => {
  const rendered = await renderWithWorkouts(useAddSessionExercise, undefined);
  const stored = (id: string) => storedSnapshot(rendered.runtime, id);
  return { ...rendered, stored };
};

beforeEach(() => {
  resetAllStores();
  sessionLifecycle.restore(aSession());
});

describe('useAddSessionExercise', () => {
  it('adds the exercise to the workout and makes it the current one', async () => {
    const { result, done } = await renderAdd();

    let added = false;
    await act(async () => {
      added = await result.current.add(DIPS, TARGET, false);
    });

    expect(added).toBe(true);
    expect(live()?.entries.map(entry => entry.exerciseName)).toEqual(['Bench Press', 'Overhead Press', 'Dips']);
    expect(live()?.activeIndex).toBe(2);
    await done();
  });

  it('stores the exercise, so the workout stays readable if the catalog drops it', async () => {
    const { result, stored, done } = await renderAdd();

    await act(async () => void (await result.current.add(DIPS, TARGET, false)));

    expect((await stored('wger:99'))?.name).toBe('Dips');
    await done();
  });

  it('adds nothing for an exercise already in the workout', async () => {
    const { result, stored, done } = await renderAdd();

    let added = true;
    await act(async () => {
      added = await result.current.add(DIPS, TARGET, true);
    });

    expect(added).toBe(false);
    expect(live()?.entries).toHaveLength(2);
    expect(await stored('wger:99')).toBeUndefined();
    await done();
  });

  it('adds nothing when no workout is in progress', async () => {
    useSessionStore.getState().ended(aSession().id);
    const { result, done } = await renderAdd();

    let added = true;
    await act(async () => {
      added = await result.current.add(DIPS, TARGET, false);
    });

    expect(added).toBe(false);
    expect(live()).toBeNull();
    await done();
  });

  it('rejects when the exercise cannot be stored, leaving the workout as it was', async () => {
    const { result, runtime, done } = await renderAdd();
    await refuseWrites(runtime, 'exercises', 'INSERT');

    let failure: unknown = null;
    await act(async () => {
      failure = await result.current.add(DIPS, TARGET, false).catch((error: unknown) => error);
    });

    expect(failure).toMatchObject({ _tag: 'SqlError' });
    expect(live()?.entries).toHaveLength(2);
    await done();
  });
});
