import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { anExercise, aSquat } from '@/features/home/__fixtures__/builders';
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

    expect(result.current.picker.effects.isIncluded('ex:barbell-bench-press')).toBe(true);
    expect(result.current.picker.effects.isIncluded('ex:goblet-squat')).toBe(false);
    await done();
  });

  it('appends a picked exercise to the routine', async () => {
    const { result, done } = await renderPicker();

    await act(async () => result.current.picker.effects.pick(aSquat()));

    await waitFor(() =>
      expect(result.current.saved.routine?.items.map(item => item.exerciseName)).toEqual(['Bench Press', 'Squat']),
    );
    expect(result.current.picker.effects.isIncluded('ex:goblet-squat')).toBe(true);
    expect(result.current.picker.state.error).toBeNull();
    await done();
  });

  it("removes an included exercise on a second tap, through the routine's own remove", async () => {
    const { result, done } = await renderPicker();
    await act(async () => result.current.picker.effects.pick(aSquat()));
    await waitFor(() => expect(result.current.saved.routine?.items).toHaveLength(2));

    await act(async () => result.current.picker.effects.unpick('ex:barbell-bench-press'));

    await waitFor(() => expect(result.current.saved.routine?.items.map(item => item.exerciseName)).toEqual(['Squat']));
    expect(result.current.picker.effects.isIncluded('ex:barbell-bench-press')).toBe(false);
    expect(result.current.picker.state.error).toBeNull();
    await done();
  });

  it('adds after the remaining items once one has been removed, so the positions were renumbered', async () => {
    const { result, done } = await renderPicker();
    await act(async () => result.current.picker.effects.pick(aSquat()));
    await waitFor(() => expect(result.current.saved.routine?.items).toHaveLength(2));
    await act(async () => result.current.picker.effects.unpick('ex:barbell-bench-press'));
    await waitFor(() => expect(result.current.saved.routine?.items).toHaveLength(1));

    await act(async () => result.current.picker.effects.pick(anExercise()));

    await waitFor(() =>
      expect(result.current.saved.routine?.items.map(item => item.exerciseName)).toEqual(['Squat', 'Bench Press']),
    );
    await done();
  });

  it('removes nothing for an exercise the routine does not have', async () => {
    const { result, done } = await renderPicker();

    await act(async () => result.current.picker.effects.unpick('ex:goblet-squat'));

    expect(result.current.saved.routine?.items.map(item => item.exerciseName)).toEqual(['Bench Press']);
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
