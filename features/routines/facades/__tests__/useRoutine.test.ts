import { act, waitFor } from '@testing-library/react-native';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderWithLayer } from '@/features/core/testing';
import { anExerciseSnapshot, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { markRoutineUsed } from '@/features/routines/di/__tests__/routinesTestData';
import { RoutinesTestLayer } from '@/features/routines/di/__tests__/routinesTestLayer';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { routineQueryKeys } from '@/features/routines/facades/routineQueryKeys';
import { useRoutine } from '@/features/routines/facades/useRoutine';
import { useSaveRoutine } from '@/features/routines/facades/useSaveRoutine';
import { updateSettings } from '@/features/settings';

/** Which opening of the routine screen this is: a new one mounts the hook afresh. */
let opening = 0;
const asScreen = (children: ReactNode) => createElement(Fragment, { key: `opening-${opening}` }, children);

beforeEach(() => {
  opening = 0;
});

afterEach(() => updateSettings({ language: 'system' }));

const PUSH_DAY = { name: 'Push Day', items: [aRoutineItem()], snapshots: [anExerciseSnapshot()] };

const useRoutineScreen = (id: RoutineId | null) => ({ detail: useRoutine(id), save: useSaveRoutine() });

describe('useRoutine', () => {
  it('reads the trained count a finished workout changed when the routine screen opens again', async () => {
    const { result, rerender, runtime, client, done } = await renderWithLayer(
      RoutinesTestLayer,
      useRoutineScreen,
      null as RoutineId | null,
      asScreen,
    );
    // NOTE: as the app's client (`core/query/queryClient.ts`), which does not refetch on mount.
    client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, refetchOnMount: false } });
    let id = RoutineId.make('none');
    await act(async () => {
      id = (await result.current.save.mutateAsync(PUSH_DAY)).id;
    });
    await act(async () => rerender(id));
    await waitFor(() => expect(result.current.detail.routine?.timesCompleted).toBe(0));

    await act(async () => rerender(null));
    await markRoutineUsed(runtime, id, Date.now());
    // NOTE: what a finished workout invalidates (`invalidateAfterWorkout`): the whole routines prefix.
    await client.invalidateQueries({ queryKey: routineQueryKeys.all });
    opening += 1;
    await act(async () => rerender(id));

    await waitFor(() => expect(result.current.detail.routine?.timesCompleted).toBe(1));
    await done();
  });

  it('names the stored muscles and equipment of an item picked in Italian in the language of the app', async () => {
    updateSettings({ language: 'en' });
    const { result, rerender, done } = await renderWithLayer(
      RoutinesTestLayer,
      useRoutineScreen,
      null as RoutineId | null,
    );
    const picked = anExerciseSnapshot({
      category: 'Petto',
      primaryMuscles: ['Petto'],
      secondaryMuscles: [],
      equipment: ['Panca'],
    });
    let id = RoutineId.make('none');
    await act(async () => {
      id = (await result.current.save.mutateAsync({ ...PUSH_DAY, snapshots: [picked] })).id;
    });

    await act(async () => rerender(id));

    await waitFor(() =>
      expect(result.current.detail.snapshots.get('wger:73')).toMatchObject({
        category: 'Chest',
        primaryMuscles: ['Chest'],
        equipment: ['Bench'],
      }),
    );
    await done();
  });
});
