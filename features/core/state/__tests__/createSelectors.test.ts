import { act, renderHook } from '@testing-library/react-native';
import { createSelectors, createStore, resetAllStores } from '@/features/core/state';

const useCounter = createSelectors(
  createStore<{ readonly count: number; readonly increment: () => void }>(set => ({
    count: 0,
    increment: () => set(state => ({ count: state.count + 1 })),
  })),
);

afterEach(resetAllStores);

describe('createSelectors', () => {
  it('exposes one hook per key, which re-renders when that key changes', async () => {
    const { result } = await renderHook(() => useCounter.use.count());
    expect(result.current).toBe(0);
    await act(() => useCounter.getState().increment());
    expect(result.current).toBe(1);
  });

  it('resetAllStores puts the store back to its initial state', () => {
    useCounter.getState().increment();
    resetAllStores();
    expect(useCounter.getState().count).toBe(0);
  });
});
