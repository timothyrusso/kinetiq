import { act, waitFor } from '@testing-library/react-native';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderWithLayer } from '@/features/core/testing';
import { aCompletedWorkout } from '@/features/workouts/__fixtures__/builders';
import { recordHistory } from '@/features/workouts/di/__tests__/workoutsTestData';
import { WorkoutsTestLayer } from '@/features/workouts/di/__tests__/workoutsTestLayer';
import { usePreviousPerformance } from '@/features/workouts/facades/usePreviousPerformance';
import { invalidateAfterWatchWorkouts, invalidateAfterWorkout } from '@/features/workouts/facades/workoutQueryKeys';

const BENCH = ['ex:barbell-bench-press'];

/** Which opening of the session screen this is: a new one mounts the hook afresh. */
let opening = 0;
const asScreen = (children: ReactNode) => createElement(Fragment, { key: `opening-${opening}` }, children);

beforeEach(() => {
  opening = 0;
});

describe('usePreviousPerformance', () => {
  it('reads the workout just finished when the session screen opens again', async () => {
    const { result, rerender, runtime, client, done } = await renderWithLayer(
      WorkoutsTestLayer,
      ({ routineId }: { readonly routineId: string | null }) => usePreviousPerformance(routineId, BENCH),
      { routineId: 'rtn_push' },
      asScreen,
    );
    // NOTE: as the app's client (`core/query/queryClient.ts`), which does not refetch on mount.
    client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, refetchOnMount: false } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.get('ex:barbell-bench-press')).toBeUndefined();

    await act(async () => rerender({ routineId: null }));
    await recordHistory(runtime, [aCompletedWorkout()]);
    invalidateAfterWorkout(client, 'rtn_push');
    opening += 1;
    await act(async () => rerender({ routineId: 'rtn_push' }));

    await waitFor(() => expect(result.current.get('ex:barbell-bench-press')?.sets).toHaveLength(2));
    await done();
  });

  it('reads a workout drained from the watch when the session screen opens again', async () => {
    const { result, rerender, runtime, client, done } = await renderWithLayer(
      WorkoutsTestLayer,
      ({ routineId }: { readonly routineId: string | null }) => usePreviousPerformance(routineId, BENCH),
      { routineId: 'rtn_push' },
      asScreen,
    );
    client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, refetchOnMount: false } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.get('ex:barbell-bench-press')).toBeUndefined();

    await act(async () => rerender({ routineId: null }));
    await recordHistory(runtime, [aCompletedWorkout()]);
    invalidateAfterWatchWorkouts(client);
    opening += 1;
    await act(async () => rerender({ routineId: 'rtn_push' }));

    await waitFor(() => expect(result.current.get('ex:barbell-bench-press')?.sets).toHaveLength(2));
    await done();
  });
});
