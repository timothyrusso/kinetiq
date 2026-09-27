import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { routerFake } from '@/features/core/testing';
import { aSession, aSet } from '@/features/workouts/__fixtures__/builders';
import { sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import { useSetPageLogic } from '@/features/workouts/ui/pages/SetPage/SetPage.logic';

const renderSet = async (entry: number, set: number) => {
  sessionLifecycle.restore(aSession());
  routerFake.setParams({ entry: String(entry), set: String(set) });
  return renderHook(useSetPageLogic);
};

const liveSets = () => useSessionStore.getState().session?.entries[0]?.sets ?? [];

beforeEach(() => {
  resetAllStores();
});

describe('useSetPageLogic', () => {
  it('reads the set the route names from the workout in progress', async () => {
    const { result } = await renderSet(0, 1);

    expect(result.current.state.entry?.exerciseName).toBe('Bench Press');
    expect(result.current.state.set).toEqual(aSet({ index: 1 }));
  });

  it('reads nothing for a position the workout does not have', async () => {
    const { result } = await renderSet(5, 0);

    expect(result.current.state.set).toBeUndefined();
  });

  it('writes a change to the set and shows it', async () => {
    const { result } = await renderSet(0, 1);

    await act(async () => result.current.effects.change({ reps: 8 }));

    expect(result.current.state.set?.reps).toBe(8);
  });

  it('removes the set and closes the sheet', async () => {
    const { result } = await renderSet(0, 1);

    await act(async () => result.current.effects.remove());

    expect(liveSets()).toHaveLength(1);
    expect(routerFake.history).toEqual([{ verb: 'back', href: null }]);
  });
});
