import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import { useSetEditor } from '@/features/workouts/hooks/useSetEditor';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

beforeEach(() => {
  resetAllStores();
  useSessionStore.getState().start(aSession(), 1_000);
});

describe('useSetEditor', () => {
  it('reads the set the route names from the workout in progress', async () => {
    const { result } = await renderHook(() => useSetEditor(1, 2));

    expect(result.current.entry?.exerciseName).toBe('Overhead Press');
    expect(result.current.set).toMatchObject({ index: 2, reps: 8, weightKg: 40 });
  });

  it('shows each change at once, as the session holds it', async () => {
    const { result } = await renderHook(() => useSetEditor(1, 2));

    await act(async () => result.current.change({ reps: 10 }));

    expect(result.current.set?.reps).toBe(10);
    expect(useSessionStore.getState().session?.entries[1]?.sets[2]?.reps).toBe(10);
  });

  it('removes the set from the workout', async () => {
    const { result } = await renderHook(() => useSetEditor(1, 2));

    await act(async () => result.current.remove());

    expect(useSessionStore.getState().session?.entries[1]?.sets).toHaveLength(2);
  });

  it('has no set for a position the workout does not have', async () => {
    const { result } = await renderHook(() => useSetEditor(4, 0));

    expect(result.current.entry).toBeUndefined();
    expect(result.current.set).toBeUndefined();
  });
});
