import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aSquat } from '@/features/home/__fixtures__/builders';
import { HomeTestLayer, seedRoutine } from '@/features/home/di/__tests__/homeTestLayer';
import { usePickIntoRoutineLogic } from '@/features/home/ui/components/PickInto/PickIntoRoutine.logic';
import { RoutineId, useRoutine } from '@/features/routines';

beforeEach(() => {
  resetAllStores();
});

const usePicker = (routineId: RoutineId) => ({
  picker: usePickIntoRoutineLogic(routineId),
  saved: useRoutine(routineId),
});

/** Renders the picker over a stored push day with the bench press in it. */
const renderPicker = async () => {
  const seeded = await renderWithLayer(HomeTestLayer, usePicker, RoutineId.make('none'));
  const routine = await seeded.runtime.runPromise(seedRoutine('Push Day'));
  await seeded.rerender(routine.id);
  await waitFor(() => expect(seeded.result.current.saved.routine?.items).toHaveLength(1));
  return seeded;
};

describe('usePickIntoRoutineLogic', () => {
  it('marks the exercises the routine already has as included', async () => {
    const { result, done } = await renderPicker();

    expect(result.current.picker.effects.isIncluded('wger:73')).toBe(true);
    expect(result.current.picker.effects.isIncluded('wger:13')).toBe(false);
    await done();
  });

  it('appends a picked exercise to the routine', async () => {
    const { result, done } = await renderPicker();

    await act(async () => result.current.picker.effects.pick(aSquat()));

    await waitFor(() =>
      expect(result.current.saved.routine?.items.map(item => item.exerciseName)).toEqual(['Bench Press', 'Squat']),
    );
    expect(result.current.picker.effects.isIncluded('wger:13')).toBe(true);
    expect(result.current.picker.state.error).toBeNull();
    await done();
  });

  it('says the add failed for a routine that is gone, and adds nothing', async () => {
    const { result, done } = await renderWithLayer(HomeTestLayer, usePicker, RoutineId.make('rtn_gone'));

    await act(async () => result.current.picker.effects.pick(aSquat()));

    await waitFor(() => expect(result.current.picker.state.error).toBe(tr('routine.addFailed')));
    expect(result.current.saved.routine).toBeNull();
    await done();
  });

  it('names the routine in the picker footer when picking into a saved routine', async () => {
    const { result, done } = await renderPicker();

    expect(result.current.picker.state.destination).toBe('routine');
    await done();
  });
});
