import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { anExercise } from '@/features/routines/__fixtures__/builders';
import { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';
import { aPushDay, renderRoutinesPage } from '@/features/routines/ui/pages/__tests__/renderOnRoutine';
import { useNewRoutinePageLogic } from '@/features/routines/ui/pages/NewRoutinePage/NewRoutinePage.logic';
import { createRoutine } from '@/features/routines/useCases/createRoutine';
import { updateSettings } from '@/features/settings';

const useBuilder = () => ({ page: useNewRoutinePageLogic(), draft: useRoutineDraft() });

const renderBuilder = () => renderRoutinesPage(useBuilder, undefined);

/** The builder with the bench press added and the name typed. */
const renderFilledBuilder = async (name = 'Chest Day') => {
  const rendered = await renderBuilder();
  await act(async () => {
    rendered.result.current.draft.actions.addExercise(anExercise());
    rendered.result.current.page.effects.setName(name);
  });
  return rendered;
};

beforeEach(() => {
  resetAllStores();
});

describe('useNewRoutinePageLogic', () => {
  it('opens on an empty draft with the rest the settings ask for', async () => {
    updateSettings({ defaultRestSeconds: 120 });

    const { result, done } = await renderBuilder();

    expect(result.current.page.state.draft.items).toEqual([]);
    expect(result.current.page.state.draft.defaultRestSeconds).toBe(120);
    expect(result.current.page.derived.savable).toBe(false);
    await done();
  });

  it('refuses to save a draft with no exercises and writes nothing', async () => {
    const { result, list, done } = await renderBuilder();

    await act(async () => result.current.page.effects.save());

    expect(result.current.page.state.blocked).toBe(tr('newRoutine.addOneFirst'));
    expect(await list()).toEqual([]);
    await done();
  });

  it('saves the draft once and opens the saved routine', async () => {
    const { result, list, done } = await renderFilledBuilder();

    await act(async () => result.current.page.effects.save());

    await waitFor(() => expect(routerFake.history).toHaveLength(2));
    const saved = await list();
    expect(saved.map(routine => routine.name)).toEqual(['Chest Day']);
    expect(routerFake.history).toEqual([
      { verb: 'dismiss', href: null },
      { verb: 'push', href: routes.routine(saved[0]?.id ?? '') },
    ]);
    await done();
  });

  it('refuses a name another routine has, keeps the draft and opens nothing', async () => {
    const { result, runtime, list, done } = await renderFilledBuilder('Push Day');
    await runtime.runPromise(createRoutine(aPushDay()));

    await act(async () => result.current.page.effects.save());

    await waitFor(() => expect(result.current.page.state.blocked).toBe(tr('errors.routineNameTaken')));
    expect(result.current.page.state.draft.status).toBe('ready');
    expect(result.current.page.state.draft.items).toHaveLength(1);
    expect((await list()).map(routine => routine.name)).toEqual(['Push Day']);
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('asks before a dirty draft is left', async () => {
    const { result, leave, done } = await renderFilledBuilder();

    let prevented = false;
    await act(async () => {
      prevented = leave();
    });

    expect(prevented).toBe(true);
    expect(result.current.page.state.confirmDiscard).toBe(true);
    await done();
  });

  it('lets an untouched draft be left without asking', async () => {
    const { result, leave, done } = await renderBuilder();

    let prevented = true;
    await act(async () => {
      prevented = leave();
    });

    expect(prevented).toBe(false);
    expect(result.current.page.state.confirmDiscard).toBe(false);
    await done();
  });

  it('discards the draft and carries on with the navigation the user started', async () => {
    const { result, leave, done } = await renderFilledBuilder();
    await act(async () => void leave());

    await act(async () => result.current.page.effects.discard());

    expect(result.current.page.state.draft.items).toEqual([]);
    expect(result.current.page.state.confirmDiscard).toBe(false);
    expect(routerFake.history).toEqual([{ verb: 'dispatch', href: null }]);
    await done();
  });

  it('keeps the draft when the user keeps editing', async () => {
    const { result, leave, done } = await renderFilledBuilder();
    await act(async () => void leave());

    await act(async () => result.current.page.effects.keepEditing());

    expect(result.current.page.state.confirmDiscard).toBe(false);
    expect(result.current.page.state.draft.items).toHaveLength(1);
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('dismisses the builder on Cancel', async () => {
    const { result, done } = await renderBuilder();

    await act(async () => result.current.page.effects.cancel());

    expect(routerFake.history).toEqual([{ verb: 'dismiss', href: null }]);
    await done();
  });

  it('opens the picker for the draft', async () => {
    const { result, done } = await renderBuilder();

    await act(async () => result.current.page.effects.addExercise());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.pickExercise('draft') }]);
    await done();
  });

  it('opens a draft row’s editor', async () => {
    const { result, done } = await renderFilledBuilder();
    const itemId = result.current.page.state.draft.items[0]?.id ?? '';

    await act(async () => result.current.page.effects.openItem(itemId));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.routineItem('draft', itemId) }]);
    await done();
  });

  it('drops a row from the draft', async () => {
    const { result, done } = await renderFilledBuilder();
    const itemId = result.current.page.state.draft.items[0]?.id ?? '';

    await act(async () => result.current.page.effects.dropItem(itemId));

    expect(result.current.page.state.draft.items).toEqual([]);
    await done();
  });
});
