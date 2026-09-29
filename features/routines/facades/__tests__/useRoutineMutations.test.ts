import { act, waitFor } from '@testing-library/react-native';
import { anExercise } from '@/features/routines/__fixtures__/builders';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { defaultItemTarget, uniformSets } from '@/features/routines/domain/utils/itemTargets';
import { useRoutine } from '@/features/routines/facades/useRoutine';
import { useAddRoutineExercise, useSetRoutineItem } from '@/features/routines/facades/useRoutineMutations';
import { renderOnRoutine } from '@/features/routines/ui/pages/__tests__/renderOnRoutine';

const DIPS = anExercise({ id: 'wger:75', name: 'Dips', externalId: 75, equipment: [] });

const useRoutineWrites = (id: RoutineId | null) => ({
  detail: useRoutine(id),
  add: useAddRoutineExercise(),
  set: useSetRoutineItem(),
});

/** The writes, with the detail of the push day they write to on screen beside them. */
const renderWrites = async () => {
  const rendered = await renderOnRoutine(useRoutineWrites, null);
  await rendered.rerender(rendered.id);
  await waitFor(() => expect(rendered.result.current.detail.routine?.items).toHaveLength(2));
  return rendered;
};

describe('useAddRoutineExercise', () => {
  it('appends the exercise, stores its snapshot and refreshes the routine on screen', async () => {
    const { result, id, done } = await renderWrites();

    await act(async () => {
      await result.current.add.mutateAsync({ routineId: id, exercise: DIPS, item: defaultItemTarget(90) });
    });

    await waitFor(() => expect(result.current.detail.routine?.items.map(item => item.exerciseName)).toContain('Dips'));
    expect(result.current.detail.snapshots.get('wger:75')?.name).toBe('Dips');
    await done();
  });

  it('fails with RoutineNotFound for a routine that is gone and stores nothing', async () => {
    const { result, read, done } = await renderWrites();

    await act(async () => {
      await result.current.add
        .mutateAsync({ routineId: RoutineId.make('rtn_gone'), exercise: DIPS, item: defaultItemTarget(90) })
        .catch(() => null);
    });

    await waitFor(() => expect(result.current.add.error?._tag).toBe('RoutineNotFound'));
    expect((await read())?.routine.items).toHaveLength(2);
    await done();
  });
});

describe('useSetRoutineItem', () => {
  it('changes the item’s targets and refreshes the routine on screen', async () => {
    const { result, id, done } = await renderWrites();

    await act(async () => {
      await result.current.set.mutateAsync({
        routineId: id,
        itemId: 'rit_bench',
        patch: { sets: uniformSets(3, 8, 70) },
      });
    });

    await waitFor(() =>
      expect(result.current.detail.routine?.items.find(item => item.id === 'rit_bench')?.sets[0]?.weightKg).toBe(70),
    );
    await done();
  });
});
