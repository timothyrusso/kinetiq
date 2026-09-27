import { act, renderHook } from '@testing-library/react-native';
import type { UnitSystem } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import { anExerciseSnapshot, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
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

  it('writes an imperial weight back in kilograms', async () => {
    const { result, patches } = await renderForm({ units: 'imperial' });

    await act(async () => result.current.effects.setWeight(135));

    expect(patches).toEqual([{ weightKg: 61.23 }]);
  });

  it('reads the first number of a rep range and writes a picked count as text', async () => {
    const { result, patches } = await renderForm();

    await act(async () => result.current.effects.setReps(10));

    expect(result.current.derived.reps).toBe(8);
    expect(patches).toEqual([{ reps: '10' }]);
  });

  it('writes sets, rest and a cleared note as they are', async () => {
    const { result, patches } = await renderForm();

    await act(async () => {
      result.current.effects.setSets(5);
      result.current.effects.setRest(0);
      result.current.effects.setNotes(null);
    });

    expect(patches).toEqual([{ sets: 5 }, { restSeconds: 0 }, { notes: null }]);
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
