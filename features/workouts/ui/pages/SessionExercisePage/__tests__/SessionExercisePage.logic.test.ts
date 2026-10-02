import { act } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { routerFake } from '@/features/core/testing';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import { renderWithWorkouts } from '@/features/workouts/facades/__tests__/renderWithWorkouts';
import { sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import { useSessionExercisePageLogic } from '@/features/workouts/ui/pages/SessionExercisePage/SessionExercisePage.logic';

const renderSheet = async (params: Record<string, string>) => {
  sessionLifecycle.restore(aSession());
  routerFake.setParams(params);
  return renderWithWorkouts(useSessionExercisePageLogic, undefined);
};

beforeEach(() => {
  resetAllStores();
});

describe('useSessionExercisePageLogic', () => {
  it('reads the exercise the route names, titled with its name, highlighting the tapped set', async () => {
    const { result, done } = await renderSheet({ entry: '1', set: '2' });

    expect(result.current.state.entry?.exerciseName).toBe('Overhead Press');
    expect(result.current.derived.title).toBe('Overhead Press');
    expect(result.current.state.highlightedSet).toBe(2);
    expect(result.current.derived.scrollTo).toBe(result.current.derived.highlightRef);
    await done();
  });

  it('highlights nothing and scrolls nowhere when opened from the name or on the first set', async () => {
    const fromName = await renderSheet({ entry: '1' });
    const highlighted = fromName.result.current.state.highlightedSet;
    await fromName.done();
    const firstSet = await renderSheet({ entry: '1', set: '0' });

    expect(highlighted).toBeNull();
    expect(firstSet.result.current.state.highlightedSet).toBe(0);
    expect(firstSet.result.current.derived.scrollTo).toBeUndefined();
    await firstSet.done();
  });

  it('reads nothing for a position the workout does not have', async () => {
    const { result, done } = await renderSheet({ entry: '5' });

    expect(result.current.state.entry).toBeUndefined();
    expect(result.current.derived.title).toBe('');
    await done();
  });

  it('writes every change into the workout in progress', async () => {
    const { result, done } = await renderSheet({ entry: '1', set: '0' });

    await act(async () => {
      result.current.effects.changeSet(0, { reps: 10 });
      result.current.effects.addSet();
      result.current.effects.removeSet(1);
      result.current.effects.changeEntry({ restSeconds: 75 });
    });

    const entry = useSessionStore.getState().session?.entries[1];
    expect(entry?.sets.map(set => set.reps)).toEqual([10, 8, 8]);
    expect(entry?.restSeconds).toBe(75);
    expect(result.current.state.entry).toBe(entry);
    await done();
  });
});
