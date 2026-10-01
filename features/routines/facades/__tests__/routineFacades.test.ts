import { act, waitFor } from '@testing-library/react-native';
import { anExerciseSnapshot, anotherRoutineItem, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { renderWithRoutines } from '@/features/routines/facades/__tests__/renderWithRoutines';
import { useRoutine } from '@/features/routines/facades/useRoutine';
import { useRenameRoutine } from '@/features/routines/facades/useRoutineMutations';
import { useRoutines } from '@/features/routines/facades/useRoutines';
import { useSaveRoutine } from '@/features/routines/facades/useSaveRoutine';

const NEW_ROUTINE = {
  name: 'Push Day',
  items: [aRoutineItem(), anotherRoutineItem()],
  snapshots: [anExerciseSnapshot(), anExerciseSnapshot({ exerciseId: 'ex:barbell-squat', name: 'Overhead Press' })],
};

/** The list, one routine's detail, and the writes, in one component like a screen and its sheet. */
const useRoutineScreen = (id: RoutineId | null) => ({
  list: useRoutines(),
  detail: useRoutine(id),
  save: useSaveRoutine(),
  rename: useRenameRoutine(),
});

describe('the routine facades', () => {
  it('starts with an empty list that says it is empty', async () => {
    const { result, done } = await renderWithRoutines(useRoutineScreen, null);

    await waitFor(() => expect(result.current.list.isEmpty).toBe(true));
    expect(result.current.list.count).toBe(0);
    await done();
  });

  it('saves a routine and shows it in the list', async () => {
    const { result, done } = await renderWithRoutines(useRoutineScreen, null);
    await waitFor(() => expect(result.current.list.isLoading).toBe(false));

    await act(async () => void (await result.current.save.mutateAsync(NEW_ROUTINE)));

    await waitFor(() => expect(result.current.list.routines.map(routine => routine.name)).toEqual(['Push Day']));
    await done();
  });

  it('reads a routine with the stored snapshots of its exercises', async () => {
    const { result, rerender, done } = await renderWithRoutines(useRoutineScreen, null);
    let id = RoutineId.make('none');
    await act(async () => {
      id = (await result.current.save.mutateAsync(NEW_ROUTINE)).id;
    });

    await rerender(id);

    await waitFor(() => expect(result.current.detail.routine?.name).toBe('Push Day'));
    expect(result.current.detail.snapshots.get('ex:barbell-bench-press')?.name).toBe('Bench Press');
    expect(result.current.detail.missing).toBe(false);
    await done();
  });

  it('says a routine that does not exist is missing, not loading or failed', async () => {
    const { result, done } = await renderWithRoutines(useRoutineScreen, RoutineId.make('rtn_gone'));

    await waitFor(() => expect(result.current.detail.missing).toBe(true));
    expect(result.current.detail.error).toBeNull();
    await done();
  });

  it('hands a name another routine has to the screen as RoutineNameTaken', async () => {
    const { result, done } = await renderWithRoutines(useRoutineScreen, null);
    await act(async () => void (await result.current.save.mutateAsync(NEW_ROUTINE)));

    await act(async () => result.current.save.mutate(NEW_ROUTINE));

    await waitFor(() => expect(result.current.save.error?._tag).toBe('RoutineNameTaken'));
    expect(result.current.list.count).toBe(1);
    await done();
  });

  it('shows a rename in the list and the detail', async () => {
    const { result, rerender, done } = await renderWithRoutines(useRoutineScreen, null);
    let id = RoutineId.make('none');
    await act(async () => {
      id = (await result.current.save.mutateAsync(NEW_ROUTINE)).id;
    });
    await rerender(id);
    await waitFor(() => expect(result.current.detail.routine?.name).toBe('Push Day'));

    await act(async () => result.current.rename.mutateAsync({ id, name: 'Chest' }));

    await waitFor(() => expect(result.current.detail.routine?.name).toBe('Chest'));
    expect(result.current.list.routines.map(routine => routine.name)).toEqual(['Chest']);
    await done();
  });
});
