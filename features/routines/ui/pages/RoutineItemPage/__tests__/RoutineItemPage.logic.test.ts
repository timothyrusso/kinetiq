import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { routerFake } from '@/features/core/testing';
import { anExercise } from '@/features/routines/__fixtures__/builders';
import { uniformSets } from '@/features/routines/domain/utils/itemTargets';
import { renderWithRoutines } from '@/features/routines/facades/__tests__/renderWithRoutines';
import { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';
import { renderOnRoutine } from '@/features/routines/ui/pages/__tests__/renderOnRoutine';
import { useRoutineItemPageLogic } from '@/features/routines/ui/pages/RoutineItemPage/RoutineItemPage.logic';

const renderSavedItem = async () => {
  const rendered = await renderOnRoutine(useRoutineItemPageLogic, undefined, {
    params: { target: 'routine', item: 'rit_press' },
  });
  await waitFor(() => expect(rendered.result.current.state.item?.id).toBe('rit_press'));
  return rendered;
};

const useDraftItem = () => ({ page: useRoutineItemPageLogic(), draft: useRoutineDraft() });

/** The builder open with the bench press in it, and the sheet routed to that row. */
const renderDraftItem = async () => {
  const rendered = await renderWithRoutines(useDraftItem, undefined);
  await act(async () => {
    rendered.result.current.draft.actions.open(90);
    rendered.result.current.draft.actions.addExercise(anExercise());
  });
  const itemId = rendered.result.current.draft.draft.items[0]?.id ?? '';
  routerFake.setParams({ target: 'draft', item: itemId });
  await rendered.rerender(undefined);
  return { ...rendered, itemId };
};

describe('useRoutineItemPageLogic on a saved routine', () => {
  it('shows the item with its stored snapshot, titled by its exercise', async () => {
    const { result, done } = await renderSavedItem();

    expect(result.current.state.snapshot?.name).toBe('Overhead Press');
    expect(result.current.derived.title).toBe('Overhead Press');
    await done();
  });

  it('writes a change to the saved item', async () => {
    const { result, read, done } = await renderSavedItem();

    await act(async () => result.current.effects.change(() => ({ sets: uniformSets(5, 6, 40) })));

    await waitFor(() => expect(result.current.state.item?.sets).toHaveLength(5));
    expect((await read())?.routine.items.find(item => item.id === 'rit_press')?.sets).toEqual(uniformSets(5, 6, 40));
    await done();
  });

  it('removes the item from the saved routine and closes the sheet', async () => {
    const { result, read, done } = await renderSavedItem();

    await act(async () => result.current.effects.remove());

    await waitFor(async () => expect((await read())?.routine.items.map(item => item.id)).toEqual(['rit_bench']));
    expect(routerFake.history).toEqual([{ verb: 'back', href: null }]);
    await done();
  });

  it('shows nothing for an item the routine does not have', async () => {
    const { result, rerender, id, done } = await renderSavedItem();
    routerFake.setParams({ target: 'routine', item: 'rit_gone', id });

    await rerender(undefined);

    expect(result.current.state.item).toBeNull();
    await done();
  });
});

describe('useRoutineItemPageLogic on the builder’s draft', () => {
  it('shows the draft row with the snapshot frozen when it was added', async () => {
    const { result, done } = await renderDraftItem();

    expect(result.current.page.state.snapshot?.name).toBe('Bench Press');
    expect(result.current.page.derived.title).toBe('Bench Press');
    await done();
  });

  it('writes a change into the draft, not the database', async () => {
    const { result, itemId, done } = await renderDraftItem();

    await act(async () => result.current.page.effects.change(() => ({ sets: uniformSets(3, 5, 0) })));

    expect(result.current.draft.draft.items.find(item => item.id === itemId)?.sets).toEqual(uniformSets(3, 5, 0));
    await done();
  });

  it('removes the row from the draft and closes the sheet', async () => {
    const { result, done } = await renderDraftItem();

    await act(async () => result.current.page.effects.remove());

    expect(result.current.draft.draft.items).toEqual([]);
    expect(routerFake.history).toEqual([{ verb: 'back', href: null }]);
    await done();
  });

  it('opens the exercise page over the sheet from the About block, whose photo moves while focused', async () => {
    const { result, done } = await renderSavedItem();
    const exerciseId = result.current.state.item?.exerciseId ?? '';

    await act(async () => result.current.state.about.onOpen());

    expect(result.current.state.about.animating).toBe(true);
    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.exerciseDetail(exerciseId, true) }]);
    await done();
  });
});
