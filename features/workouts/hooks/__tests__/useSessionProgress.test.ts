import { renderHook } from '@testing-library/react-native';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { useSessionProgress } from '@/features/workouts/hooks/useSessionProgress';

describe('useSessionProgress', () => {
  it('counts the sets done, the sets planned and the volume of the done ones', async () => {
    const { result } = await renderHook(() => useSessionProgress(aSession()));

    expect(result.current).toEqual({ completed: 2, planned: 5, ratio: 0.4, volumeKg: 1000 });
  });

  it('reports nothing done without a session', async () => {
    const { result } = await renderHook(() => useSessionProgress(null));

    expect(result.current).toEqual({ completed: 0, planned: 0, ratio: 0, volumeKg: 0 });
  });

  it('keeps the same answer across a clock tick, which leaves the entries alone', async () => {
    const session = aSession();
    const { result, rerender } = await renderHook((current: WorkoutSession) => useSessionProgress(current), {
      initialProps: session,
    });
    const before = result.current;

    await rerender({ ...session, elapsedSeconds: session.elapsedSeconds + 1 });

    expect(result.current).toBe(before);
  });
});
