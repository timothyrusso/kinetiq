import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { aRoutineItem } from '@/features/home/__fixtures__/builders';
import { HomeTestLayer, seedRoutine } from '@/features/home/di/__tests__/homeTestLayer';
import { useRoutineDetailPageLogic } from '@/features/home/ui/pages/RoutineDetailPage/RoutineDetailPage.logic';
import type { Routine, RoutineItem } from '@/features/routines';
import { useActiveSession } from '@/features/workouts';

beforeEach(() => {
  resetAllStores();
});

const useRoutineScreen = () => ({ page: useRoutineDetailPageLogic(), live: useActiveSession() });

/** Renders the routine screen's launcher and stores `name` with `items` (the builder's one by default). */
const renderLauncher = async (name: string, items?: readonly RoutineItem[]) => {
  const rendered = await renderWithLayer(HomeTestLayer, useRoutineScreen, undefined);
  let routine: Routine | null = null;
  await act(async () => {
    routine = await rendered.runtime.runPromise(seedRoutine(name, items));
  });
  if (routine === null) throw new Error('the routine was not stored');
  return { ...rendered, routine: routine as Routine };
};

describe('useRoutineDetailPageLogic', () => {
  it('starts a workout from the routine, named after it and counted against it', async () => {
    const { result, routine, done } = await renderLauncher('Push Day');
    const outcomes: boolean[] = [];

    await act(async () => result.current.page.effects.launcher.start(routine, started => void outcomes.push(started)));

    await waitFor(() => expect(outcomes).toEqual([true]));
    expect(result.current.live.session?.routineName).toBe('Push Day');
    expect(result.current.live.session?.routineId).toBe(routine.id);
    expect(result.current.page.effects.launcher.running).toEqual({ name: 'Push Day' });
    await done();
  });

  it('plans each set of the workout from its own stored row: reps, weight and target RPE', async () => {
    const pyramid = aRoutineItem({
      sets: [
        { type: 'weightReps' as const, index: 0, reps: 12, weightKg: 50, targetRpe: null },
        { type: 'weightReps' as const, index: 1, reps: 10, weightKg: 55, targetRpe: 7 },
        { type: 'weightReps' as const, index: 2, reps: 8, weightKg: 60, targetRpe: 8.5 },
        { type: 'weightReps' as const, index: 3, reps: 6, weightKg: 0, targetRpe: 10 },
      ],
    });
    const { result, routine, done } = await renderLauncher('Pyramid', [pyramid]);

    await act(async () => result.current.page.effects.launcher.start(routine, () => undefined));

    await waitFor(() => expect(result.current.live.session).not.toBeNull());
    const sets = result.current.live.session?.entries[0]?.sets ?? [];
    expect(
      sets.map(set => ({
        index: set.index,
        reps: set.type === 'duration' ? null : set.reps,
        weightKg: set.type === 'weightReps' ? set.weightKg : null,
        rpe: set.rpe,
        completed: set.completed,
      })),
    ).toEqual([
      { index: 0, reps: 12, weightKg: 50, rpe: null, completed: false },
      { index: 1, reps: 10, weightKg: 55, rpe: 7, completed: false },
      { index: 2, reps: 8, weightKg: 60, rpe: 8.5, completed: false },
      { index: 3, reps: 6, weightKg: 0, rpe: 10, completed: false },
    ]);
    await done();
  });

  it('refuses a routine with no exercises and starts nothing', async () => {
    const { result, routine, done } = await renderLauncher('Empty', []);
    const outcomes: boolean[] = [];

    await act(async () => result.current.page.effects.launcher.start(routine, started => void outcomes.push(started)));

    expect(outcomes).toEqual([false]);
    expect(result.current.live.session).toBeNull();
    expect(result.current.page.effects.launcher.running).toBeNull();
    await done();
  });
});
