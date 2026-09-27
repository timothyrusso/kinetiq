import { act, waitFor } from '@testing-library/react-native';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { aPushDay, renderOnRoutine } from '@/features/routines/ui/pages/__tests__/renderOnRoutine';
import { useRenameRoutinePageLogic } from '@/features/routines/ui/pages/RenameRoutinePage/RenameRoutinePage.logic';

const renderRename = async () => {
  const rendered = await renderOnRoutine(useRenameRoutinePageLogic, undefined);
  await waitFor(() => expect(rendered.result.current.state.name).toBe('Push Day'));
  return rendered;
};

describe('useRenameRoutinePageLogic', () => {
  it('starts from the routine’s current name', async () => {
    const { result, done } = await renderRename();

    expect(result.current.derived.error).toBeNull();
    await done();
  });

  it('saves the trimmed name and closes the sheet', async () => {
    const { result, read, done } = await renderRename();

    await act(async () => result.current.effects.change('  Chest Day  '));
    await act(async () => result.current.effects.commit());

    await waitFor(() => expect(routerFake.history).toEqual([{ verb: 'back', href: null }]));
    expect((await read())?.routine.name).toBe('Chest Day');
    await done();
  });

  it('refuses an empty name inline and keeps the old one', async () => {
    const { result, read, done } = await renderRename();

    await act(async () => result.current.effects.change('   '));
    await act(async () => result.current.effects.commit());

    expect(result.current.derived.error).toBe(tr('routine.nameRequired'));
    expect((await read())?.routine.name).toBe('Push Day');
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('refuses a name another routine has, keeps the sheet open and the name unchanged', async () => {
    const { result, save, read, done } = await renderRename();
    await save(aPushDay({ name: 'Leg Day', items: [aRoutineItem({ id: 'rit_squat' })] }));

    await act(async () => result.current.effects.change('Leg Day'));
    await act(async () => result.current.effects.commit());

    await waitFor(() => expect(result.current.derived.error).toBe(tr('errors.routineNameTaken')));
    expect((await read())?.routine.name).toBe('Push Day');
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('clears the error as soon as the name is edited again', async () => {
    const { result, done } = await renderRename();
    await act(async () => result.current.effects.change(''));
    await act(async () => result.current.effects.commit());

    await act(async () => result.current.effects.change('Chest'));

    expect(result.current.derived.error).toBeNull();
    await done();
  });
});
