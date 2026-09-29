import { act, renderHook } from '@testing-library/react-native';
import type { UnitSystem } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import { anExerciseSnapshot, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { uniformSets } from '@/features/routines/domain/utils/itemTargets';
import { useItemEditorFormLogic } from '@/features/routines/ui/components/ItemEditorForm/ItemEditorForm.logic';

const renderForm = async ({
  item = aRoutineItem(),
  snapshot = anExerciseSnapshot(),
  units = 'metric',
}: {
  item?: RoutineItem;
  snapshot?: ExerciseSnapshot | null;
  units?: UnitSystem;
} = {}) => {
  const patches: Partial<ItemTarget>[] = [];
  const onChange = (patch: Partial<ItemTarget>) => void patches.push(patch);
  const rendered = await renderHook(() => useItemEditorFormLogic(item, snapshot, units, onChange));
  return { ...rendered, patches };
};

describe('useItemEditorFormLogic', () => {
  const sets = [
    { index: 0, reps: 10, weightKg: 50, targetRpe: null },
    { index: 1, reps: 8, weightKg: 60, targetRpe: 8 },
  ];

  it('shows a metric weight in kilograms on a one-kilogram stepper', async () => {
    const { result } = await renderForm();

    expect(result.current.derived).toMatchObject({ unit: 'kg', weightStep: 1, weightMax: 450 });
    expect(result.current.derived.rows[0]).toMatchObject({ weight: 60 });
  });

  it('shows an imperial weight in whole pounds on a two-and-a-half-pound stepper', async () => {
    const { result } = await renderForm({ units: 'imperial' });

    expect(result.current.derived).toMatchObject({ unit: 'lb', weightStep: 2.5, weightMax: 1000 });
    expect(result.current.derived.rows[0]).toMatchObject({ weight: 132 });
  });

  it('draws one row per set, with no target RPE as zero', async () => {
    const { result } = await renderForm({ item: aRoutineItem({ sets }) });

    expect(result.current.derived.rows).toEqual([
      { key: 'set-0', index: 0, reps: 10, weight: 50, rpe: 0 },
      { key: 'set-1', index: 1, reps: 8, weight: 60, rpe: 8 },
    ]);
  });

  it('edits the reps, weight and target RPE of one set only', async () => {
    const { result, patches } = await renderForm({ item: aRoutineItem({ sets }) });

    await act(async () => {
      result.current.effects.setReps(1, 12);
      result.current.effects.setWeight(0, 55);
      result.current.effects.setRpe(0, 7);
      result.current.effects.setRpe(1, 0);
    });

    expect(patches).toEqual([
      { sets: [sets[0], { ...sets[1], reps: 12 }] },
      { sets: [{ ...sets[0], weightKg: 55 }, sets[1]] },
      { sets: [{ ...sets[0], targetRpe: 7 }, sets[1]] },
      { sets: [sets[0], { ...sets[1], targetRpe: null }] },
    ]);
  });

  it('writes an imperial weight back in kilograms, on that set', async () => {
    const { result, patches } = await renderForm({ units: 'imperial' });

    await act(async () => result.current.effects.setWeight(2, 135));

    expect(patches).toEqual([
      { sets: [...uniformSets(2, 8, 60), { index: 2, reps: 8, weightKg: 61.23, targetRpe: null }] },
    ]);
  });

  it('adds a set by copying the last one', async () => {
    const { result, patches } = await renderForm({ item: aRoutineItem({ sets }) });

    await act(async () => result.current.effects.addSet());

    expect(patches).toEqual([{ sets: [...sets, { ...sets[1], index: 2 }] }]);
  });

  it('removes a set and renumbers the ones after it', async () => {
    const three = uniformSets(3, 8, 60).map((set, index) => ({ ...set, reps: 6 + index }));
    const { result, patches } = await renderForm({ item: aRoutineItem({ sets: three }) });

    await act(async () => result.current.effects.removeSet(1));

    expect(patches).toEqual([{ sets: [three[0], { ...three[2], index: 1 }] }]);
  });

  it('keeps between one and twenty sets', async () => {
    const one = await renderForm({ item: aRoutineItem({ sets: uniformSets(1, 8, 60) }) });
    await act(async () => one.result.current.effects.removeSet(0));
    expect(one.patches).toEqual([]);
    expect(one.result.current.derived).toMatchObject({ canRemoveSet: false, canAddSet: true });

    const twenty = await renderForm({ item: aRoutineItem({ sets: uniformSets(20, 8, 60) }) });
    await act(async () => twenty.result.current.effects.addSet());
    expect(twenty.patches).toEqual([]);
    expect(twenty.result.current.derived).toMatchObject({ canRemoveSet: true, canAddSet: false });
  });

  it('takes the stepper bounds from the shared item bounds', async () => {
    const { result } = await renderForm();

    expect(result.current.derived).toMatchObject({
      reps: { min: 1, max: 100 },
      rpe: { min: 0, max: 10 },
      rest: { min: 0, max: 600 },
    });
  });

  it('writes rest on the item and leaves every set as it is', async () => {
    const { result, patches } = await renderForm({ item: aRoutineItem({ sets }) });

    await act(async () => result.current.effects.setRest(120));

    expect(patches).toEqual([{ restSeconds: 120 }]);
  });

  it('writes rest and a cleared note as they are', async () => {
    const { result, patches } = await renderForm();

    await act(async () => {
      result.current.effects.setRest(0);
      result.current.effects.setNotes(null);
    });

    expect(patches).toEqual([{ restSeconds: 0 }, { notes: null }]);
  });

  it('tags the exercise with its muscles and equipment from the snapshot', async () => {
    const { result } = await renderForm();

    expect(result.current.derived.libraryTags.map(tag => tag.label)).toEqual(['Chest', 'Barbell']);
  });

  it('has no library tags without a snapshot', async () => {
    const { result } = await renderForm({ snapshot: null });

    expect(result.current.derived.libraryTags).toEqual([]);
  });

  it('says when the item rests for zero seconds', async () => {
    const { result } = await renderForm({ item: aRoutineItem({ restSeconds: 0 }) });

    expect(result.current.derived.zeroRest).toBe(true);
  });
});
