import { act, renderHook } from '@testing-library/react-native';
import { anExercise } from '@/features/routines/__fixtures__/builders';
import { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';

const BENCH = anExercise();
const DIPS = anExercise({ id: 'wger:75', name: 'Dips', externalId: 75 });

const renderDraft = async () => {
  const rendered = await renderHook(useRoutineDraft);
  await act(async () => rendered.result.current.actions.open(90));
  return rendered;
};

describe('useRoutineDraft', () => {
  it('opens on an empty draft even after an abandoned one', async () => {
    const { result } = await renderDraft();
    await act(async () => result.current.actions.addExercise(BENCH));

    await act(async () => result.current.actions.open(60));

    expect(result.current.draft).toMatchObject({ status: 'ready', items: [], snapshots: [], defaultRestSeconds: 60 });
  });

  it('adds an exercise with the opening targets and its snapshot', async () => {
    const { result } = await renderDraft();

    await act(async () => result.current.actions.addExercise(BENCH));

    expect(result.current.draft.items).toEqual([
      expect.objectContaining({
        exerciseId: 'wger:73',
        exerciseName: 'Bench Press',
        sets: 3,
        reps: '8-12',
        restSeconds: 90,
      }),
    ]);
    expect(result.current.draft.snapshots.map(snapshot => snapshot.exerciseId)).toEqual(['wger:73']);
    expect(result.current.actions.isDirty()).toBe(true);
  });

  it('refuses an exercise already in the draft', async () => {
    const { result } = await renderDraft();

    await act(async () => {
      result.current.actions.addExercise(BENCH);
      result.current.actions.addExercise(BENCH);
    });

    expect(result.current.draft.items).toHaveLength(1);
    expect(result.current.actions.containsExercise('wger:73')).toBe(true);
  });

  it('moves a row and ignores a move off the list', async () => {
    const { result } = await renderDraft();
    await act(async () => {
      result.current.actions.addExercise(BENCH);
      result.current.actions.addExercise(DIPS);
    });

    await act(async () => result.current.actions.moveItem(1, 0));
    await act(async () => result.current.actions.moveItem(0, 5));

    expect(result.current.draft.items.map(item => item.exerciseName)).toEqual(['Dips', 'Bench Press']);
  });

  it('removes a row and keeps its snapshot', async () => {
    const { result } = await renderDraft();
    await act(async () => result.current.actions.addExercise(BENCH));

    await act(async () => result.current.actions.removeItem(result.current.draft.items[0]?.id ?? ''));

    expect(result.current.draft.items).toEqual([]);
    expect(result.current.draft.snapshots).toHaveLength(1);
  });

  it('holds the rest default between 0 and ten minutes', async () => {
    const { result } = await renderDraft();

    await act(async () => result.current.actions.setRestDefault(900.4));

    expect(result.current.draft.defaultRestSeconds).toBe(600);
  });

  it('is savable with an exercise and not while saving', async () => {
    const { result } = await renderDraft();
    const empty = result.current.actions.isSavable();
    await act(async () => result.current.actions.addExercise(BENCH));
    const filled = result.current.actions.isSavable();

    await act(async () => result.current.actions.markSaving());

    expect([empty, filled, result.current.actions.isSavable()]).toEqual([false, true, false]);
  });

  it('is not dirty once saved', async () => {
    const { result } = await renderDraft();
    await act(async () => result.current.actions.addExercise(BENCH));

    await act(async () => result.current.actions.markSaved());

    expect(result.current.actions.isDirty()).toBe(false);
  });

  it('hands the typed name, the rows and the snapshots to the save', async () => {
    const { result } = await renderDraft();
    await act(async () => {
      result.current.actions.setName('Chest');
      result.current.actions.addExercise(BENCH);
    });

    const routine = result.current.actions.toNewRoutine();

    expect(routine.name).toBe('Chest');
    expect(routine.items.map(item => item.exerciseId)).toEqual(['wger:73']);
    expect(routine.snapshots.map(snapshot => snapshot.exerciseId)).toEqual(['wger:73']);
  });
});
