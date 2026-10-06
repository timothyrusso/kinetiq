import { act, renderHook } from '@testing-library/react-native';
import { anExercise } from '@/features/routines/__fixtures__/builders';
import { useRoutineDraft } from '@/features/routines/facades/useRoutineDraft';
import { updateSettings } from '@/features/settings';

const BENCH = anExercise();
const DIPS = anExercise({ id: 'ex:dips', name: 'Dips' });

afterEach(() => updateSettings({ language: 'system' }));

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
        exerciseId: 'ex:barbell-bench-press',
        exerciseName: 'Bench Press',
        sets: [0, 1, 2].map(index => ({ type: 'weightReps' as const, index, reps: 8, weightKg: 0, targetRpe: null })),
        restSeconds: 90,
      }),
    ]);
    expect(result.current.draft.snapshots.map(snapshot => snapshot.exerciseId)).toEqual(['ex:barbell-bench-press']);
    expect(result.current.actions.isDirty()).toBe(true);
  });

  it('opens each exercise on its catalog tracking type: a bodyweight one on reps, a hold on time', async () => {
    const { result } = await renderDraft();
    const pullups = anExercise({ id: 'ex:pullups', name: 'Pullups', force: 'pull', equipmentKeys: ['body-only'] });
    const plank = anExercise({ id: 'ex:plank', name: 'Plank', force: 'static', equipmentKeys: ['body-only'] });

    await act(async () => {
      result.current.actions.addExercise(pullups);
      result.current.actions.addExercise(plank);
    });

    expect(result.current.draft.items.map(item => [item.trackingType, item.sets[0]])).toEqual([
      ['repsOnly', { type: 'repsOnly', index: 0, reps: 8, targetRpe: null }],
      ['duration', { type: 'duration', index: 0, durationSeconds: 30, targetRpe: null }],
    ]);
  });

  it('refuses an exercise already in the draft', async () => {
    const { result } = await renderDraft();

    await act(async () => {
      result.current.actions.addExercise(BENCH);
      result.current.actions.addExercise(BENCH);
    });

    expect(result.current.draft.items).toHaveLength(1);
    expect(result.current.actions.containsExercise('ex:barbell-bench-press')).toBe(true);
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
    expect(routine.items.map(item => item.exerciseId)).toEqual(['ex:barbell-bench-press']);
    expect(routine.snapshots.map(snapshot => snapshot.exerciseId)).toEqual(['ex:barbell-bench-press']);
  });

  it('names the muscles and equipment of an exercise picked in Italian in English after a switch', async () => {
    updateSettings({ language: 'it' });
    const { result } = await renderDraft();
    const panca = anExercise({
      name: 'Panca piana',
      category: 'Petto',
      primaryMuscles: ['Petto'],
      equipment: ['Bilanciere'],
    });
    await act(async () => result.current.actions.addExercise(panca));

    await act(async () => updateSettings({ language: 'en' }));

    expect(result.current.draft.snapshots).toEqual([
      expect.objectContaining({
        name: 'Panca piana',
        category: 'Chest',
        primaryMuscles: ['Chest'],
        equipment: ['Barbell'],
      }),
    ]);
  });

  it('hands the save the muscles as picked, whatever the language on screen', async () => {
    updateSettings({ language: 'it' });
    const { result } = await renderDraft();
    await act(async () => result.current.actions.addExercise(anExercise({ primaryMuscles: ['Petto'] })));

    await act(async () => updateSettings({ language: 'en' }));

    expect(result.current.actions.toNewRoutine().snapshots[0]?.primaryMuscles).toEqual(['Petto']);
  });
});
