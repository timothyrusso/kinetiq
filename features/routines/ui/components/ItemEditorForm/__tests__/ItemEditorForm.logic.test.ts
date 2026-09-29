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
  it('shows a metric weight in kilograms on a one-kilogram stepper', async () => {
    const { result } = await renderForm();

    expect(result.current.derived).toMatchObject({ weight: 60, unit: 'kg', weightStep: 1, weightMax: 450 });
  });

  it('shows an imperial weight in whole pounds on a two-and-a-half-pound stepper', async () => {
    const { result } = await renderForm({ units: 'imperial' });

    expect(result.current.derived).toMatchObject({ weight: 132, unit: 'lb', weightStep: 2.5, weightMax: 1000 });
  });

  it('writes an imperial weight back in kilograms, on every set', async () => {
    const { result, patches } = await renderForm({ units: 'imperial' });

    await act(async () => result.current.effects.setWeight(135));

    expect(patches).toEqual([{ sets: uniformSets(3, 8, 61.23) }]);
  });

  it('shows the first set’s reps and writes a picked count on every set', async () => {
    const { result, patches } = await renderForm();

    await act(async () => result.current.effects.setReps(10));

    expect(result.current.derived).toMatchObject({ reps: 8, setCount: 3 });
    expect(patches).toEqual([{ sets: uniformSets(3, 10, 60) }]);
  });

  it('grows the sets by copying the last one and cuts them from the end', async () => {
    const sets = [
      { index: 0, reps: 10, weightKg: 50, targetRpe: null },
      { index: 1, reps: 8, weightKg: 60, targetRpe: 8 },
    ];
    const { result, patches } = await renderForm({ item: aRoutineItem({ sets }) });

    await act(async () => {
      result.current.effects.setSets(3);
      result.current.effects.setSets(1);
    });

    expect(patches).toEqual([{ sets: [...sets, { ...sets[1], index: 2 }] }, { sets: sets.slice(0, 1) }]);
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
