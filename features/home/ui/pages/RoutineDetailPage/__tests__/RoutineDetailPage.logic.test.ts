import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { HomeTestLayer, seedRoutine } from '@/features/home/di/__tests__/homeTestLayer';
import { useRoutineDetailPageLogic } from '@/features/home/ui/pages/RoutineDetailPage/RoutineDetailPage.logic';
import type { Routine } from '@/features/routines';
import { useActiveSession } from '@/features/workouts';

beforeEach(() => {
  resetAllStores();
});

const useRoutineScreen = () => ({ page: useRoutineDetailPageLogic(), live: useActiveSession() });

/** Renders the routine screen's launcher and stores `name` with `empty` or one item. */
const renderLauncher = async (name: string, empty = false) => {
  const rendered = await renderWithLayer(HomeTestLayer, useRoutineScreen, undefined);
  let routine: Routine | null = null;
  await act(async () => {
    routine = await rendered.runtime.runPromise(seedRoutine(name, empty ? [] : undefined));
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

  it('refuses a routine with no exercises and starts nothing', async () => {
    const { result, routine, done } = await renderLauncher('Empty', true);
    const outcomes: boolean[] = [];

    await act(async () => result.current.page.effects.launcher.start(routine, started => void outcomes.push(started)));

    expect(outcomes).toEqual([false]);
    expect(result.current.live.session).toBeNull();
    expect(result.current.page.effects.launcher.running).toBeNull();
    await done();
  });
});
