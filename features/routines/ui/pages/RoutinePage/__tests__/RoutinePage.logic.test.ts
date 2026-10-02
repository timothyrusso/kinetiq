import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import type { WorkoutLauncher } from '@/features/routines/domain/entities/WorkoutLauncher';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import { renderOnRoutine } from '@/features/routines/ui/pages/__tests__/renderOnRoutine';
import { useRoutinePageLogic } from '@/features/routines/ui/pages/RoutinePage/RoutinePage.logic';
import { deleteRoutine } from '@/features/routines/useCases/deleteRoutine';

const renderRoutine = async (launcher: WorkoutLauncher = aLauncher()) => {
  const rendered = await renderOnRoutine(useRoutinePageLogic, launcher);
  await waitFor(() => expect(rendered.result.current.state.routine?.name).toBe('Push Day'));
  return rendered;
};

describe('useRoutinePageLogic', () => {
  it('shows the routine’s exercises in order with their stored snapshots', async () => {
    const { result, done } = await renderRoutine();

    expect(result.current.derived.items.map(item => item.exerciseName)).toEqual(['Bench Press', 'Overhead Press']);
    expect(result.current.state.snapshots.get('ex:barbell-squat')?.name).toBe('Overhead Press');
    await done();
  });

  it('counts the exercises in the summary', async () => {
    const { result, done } = await renderRoutine();

    expect(result.current.derived.summary[0]?.label).toBe(`2 ${tr('routine.exerciseWord', { count: 2 })}`);
    await done();
  });

  it('says a routine never completed leaves nothing behind when deleted', async () => {
    const { result, done } = await renderRoutine();

    expect(result.current.derived.deleteMessage).toBe(tr('routine.deleteNever'));
    await done();
  });

  it('says a routine that does not exist is missing', async () => {
    const { result, rerender, done } = await renderRoutine();
    routerFake.setParams({ id: RoutineId.make('rtn_gone') });

    await rerender(aLauncher());

    await waitFor(() => expect(result.current.state.missing).toBe(true));
    await done();
  });

  it('starts a workout from the routine and opens the session', async () => {
    const launcher = aLauncher();
    const { result, id, done } = await renderRoutine(launcher);

    await act(async () => result.current.effects.primary());

    expect(launcher.started).toEqual([id]);
    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.workoutSession() }]);
    await done();
  });

  it('warns instead of opening a session when the workout did not start', async () => {
    const { result, done } = await renderRoutine(aLauncher({ starts: false }));

    await act(async () => result.current.effects.primary());

    expect(result.current.state.failed).toBe(tr('routine.noExercisesYet'));
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('opens the running workout from the plan instead of starting a second one', async () => {
    const launcher = aLauncher({ running: 'Leg Day' });
    const { result, done } = await renderRoutine(launcher);

    await act(async () => result.current.effects.primary());

    expect(launcher.started).toEqual([]);
    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.workoutSession() }]);
    await done();
  });

  it('names the running workout when the header asks to start another', async () => {
    const launcher = aLauncher({ running: 'Leg Day' });
    const { result, done } = await renderRoutine(launcher);

    await act(async () => result.current.effects.startFromHeader());

    expect(result.current.state.failed).toBe(tr('routine.liveNamed', { name: 'Leg Day' }));
    expect(launcher.started).toEqual([]);
    await done();
  });

  it('moves an exercise and keeps the new order', async () => {
    const { result, read, done } = await renderRoutine();

    await act(async () => result.current.effects.move(0, 1));

    await waitFor(() =>
      expect(result.current.derived.items.map(item => item.exerciseName)).toEqual(['Overhead Press', 'Bench Press']),
    );
    expect((await read())?.routine.items.map(item => item.id)).toEqual(['rit_press', 'rit_bench']);
    await done();
  });

  it('says a reorder did not stick when the routine is gone, and changes nothing', async () => {
    const { result, runtime, id, list, done } = await renderRoutine();
    await runtime.runPromise(deleteRoutine(id));

    await act(async () => result.current.effects.move(0, 1));

    await waitFor(() => expect(result.current.state.failed).toBe(tr('routine.reorderFailed')));
    expect(await list()).toEqual([]);
    await done();
  });

  it('removes an exercise from the routine', async () => {
    const { result, read, done } = await renderRoutine();

    await act(async () => result.current.effects.remove('rit_bench'));

    await waitFor(() => expect(result.current.derived.items.map(item => item.id)).toEqual(['rit_press']));
    expect((await read())?.routine.items.map(item => item.id)).toEqual(['rit_press']);
    await done();
  });

  it('duplicates the routine and replaces the screen with the copy', async () => {
    const { result, list, done } = await renderRoutine();
    const duplicate = result.current.derived.options.find(option => option.key === 'duplicate');

    await act(async () => duplicate?.onPress());

    await waitFor(() => expect(routerFake.history).toHaveLength(1));
    const copy = (await list()).find(routine => routine.name !== 'Push Day');
    expect(copy?.name).toBe('Push Day copy');
    expect(routerFake.history).toEqual([{ verb: 'replace', href: routes.routine(copy?.id ?? '') }]);
    await done();
  });

  it('says a duplicate failed when the routine is gone, and makes no copy', async () => {
    const { result, runtime, id, list, done } = await renderRoutine();
    await runtime.runPromise(deleteRoutine(id));
    const duplicate = result.current.derived.options.find(option => option.key === 'duplicate');

    await act(async () => duplicate?.onPress());

    await waitFor(() => expect(result.current.state.failed).toBe(tr('routine.duplicateFailed')));
    expect(await list()).toEqual([]);
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('asks before deleting and keeps the routine when the user cancels', async () => {
    const { result, list, done } = await renderRoutine();
    const remove = result.current.derived.options.find(option => option.key === 'delete');

    await act(async () => remove?.onPress());
    const asked = result.current.state.confirmDelete;
    await act(async () => result.current.effects.cancelDelete());

    expect(asked).toBe(true);
    expect(result.current.state.confirmDelete).toBe(false);
    expect((await list()).map(routine => routine.name)).toEqual(['Push Day']);
    await done();
  });

  it('deletes the routine and goes back', async () => {
    const { result, list, done } = await renderRoutine();

    await act(async () => result.current.effects.doDelete());

    await waitFor(() => expect(routerFake.history).toEqual([{ verb: 'back', href: null }]));
    expect(await list()).toEqual([]);
    await done();
  });

  it('lands on the Workout tab after a delete when there is nothing to go back to', async () => {
    routerFake.setCanGoBack(false);
    const { result, list, done } = await renderRoutine();

    await act(async () => result.current.effects.doDelete());

    await waitFor(() => expect(routerFake.history).toEqual([{ verb: 'replace', href: routes.workoutTab() }]));
    await waitFor(() => expect(result.current.state.missing).toBe(true));
    expect(await list()).toEqual([]);
    await done();
  });

  it('opens the rename sheet from the menu', async () => {
    const { result, id, done } = await renderRoutine();
    const rename = result.current.derived.options.find(option => option.key === 'rename');

    await act(async () => rename?.onPress());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.renameRoutine(id) }]);
    await done();
  });

  it('opens an item’s editor for the saved routine', async () => {
    const { result, id, done } = await renderRoutine();

    await act(async () => result.current.effects.openItem('rit_press'));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.routineItem('routine', 'rit_press', id) }]);
    await done();
  });

  it('opens the picker to add an exercise to the saved routine', async () => {
    const { result, id, done } = await renderRoutine();

    await act(async () => result.current.effects.addExercise());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.pickExercise('routine', id) }]);
    await done();
  });
});

/** A launcher that records what it started; `starts: false` answers like a routine with no exercises. */
function aLauncher({ running = null, starts = true }: { running?: string | null; starts?: boolean } = {}) {
  const started: string[] = [];
  const launcher: WorkoutLauncher & { readonly started: readonly string[] } = {
    running: running === null ? null : { name: running },
    starting: false,
    start: (routine, onResult) => {
      if (starts) started.push(routine.id);
      onResult(starts);
    },
    started,
  };
  return launcher;
}
