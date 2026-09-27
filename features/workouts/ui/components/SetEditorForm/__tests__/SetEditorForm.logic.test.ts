import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import { anEntry, aSet } from '@/features/workouts/__fixtures__/builders';
import type { SetPatch } from '@/features/workouts/domain/utils/sessionTransitions';
import { useSetEditorFormLogic } from '@/features/workouts/ui/components/SetEditorForm/SetEditorForm.logic';

const renderEditor = async (units: UnitSystem = 'metric', set = aSet()) => {
  const patches: SetPatch[] = [];
  return {
    ...(await renderHook(() => useSetEditorFormLogic(anEntry(), set, units, patch => void patches.push(patch)))),
    patches,
  };
};

describe('useSetEditorFormLogic', () => {
  it('names the exercise and the reps above the steppers', async () => {
    const { result } = await renderEditor();

    expect(result.current.derived.context).toEqual([
      { icon: 'dumbbell', label: 'Bench Press' },
      { icon: 'layers', label: tr('workoutFlow.repCount', { count: 5 }) },
    ]);
  });

  it('shows the weight and its ceiling in the user units', async () => {
    const { result } = await renderEditor('imperial');

    expect(result.current.derived.maxWeight).toBe(1000);
    expect(result.current.derived.displayWeight).toBe(220);
  });

  it('shows an unrecorded RPE as zero', async () => {
    const { result } = await renderEditor();

    expect(result.current.derived.rpe).toBe(0);
  });

  it('writes a new rep count', async () => {
    const { result, patches } = await renderEditor();

    await act(async () => result.current.effects.changeReps(8));

    expect(patches).toEqual([{ reps: 8 }]);
  });

  it('writes a weight in kilograms whatever the units shown', async () => {
    const { result, patches } = await renderEditor();

    await act(async () => result.current.effects.changeWeight(62.5));

    expect(patches).toEqual([{ weightKg: 62.5 }]);
  });

  it('writes an RPE of zero as not recorded', async () => {
    const { result, patches } = await renderEditor();

    await act(async () => {
      result.current.effects.changeRpe(0);
      result.current.effects.changeRpe(8);
    });

    expect(patches).toEqual([{ rpe: null }, { rpe: 8 }]);
  });
});
