import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { aDurationSet, aRepsOnlySet, aSet } from '@/features/workouts/__fixtures__/builders';
import { type SetRowInput, useSetRowLogic } from '@/features/workouts/ui/components/SetRow/SetRow.logic';

const renderRow = async (overrides: Partial<SetRowInput> = {}) => {
  const opened: [number, number][] = [];
  const toggled: [number, number][] = [];
  const input: SetRowInput = {
    entryIndex: 1,
    setIndex: 2,
    set: aSet({ index: 2 }),
    units: 'metric',
    isTarget: false,
    onOpen: (entry, set) => void opened.push([entry, set]),
    onToggle: (entry, set) => void toggled.push([entry, set]),
    ...overrides,
  };
  return { ...(await renderHook(() => useSetRowLogic(input))), opened, toggled };
};

describe('useSetRowLogic', () => {
  it('numbers the set from one and speaks its weight in the user units', async () => {
    const { result } = await renderRow({ units: 'imperial' });

    expect(result.current.derived.number).toBe(3);
    expect(result.current.derived.primary).toEqual({
      label: tr('setRow.reps'),
      value: '5',
      a11y: tr('setRow.setRepsAt', { n: 3, reps: 5, weight: '220 lb' }),
    });
    expect(result.current.derived.secondary?.a11y).toBe(tr('setRow.setWeight', { n: 3, weight: '220 lb' }));
  });

  it('shows a set with no load as bodyweight', async () => {
    const { result } = await renderRow({ set: aSet({ weightKg: 0 }) });

    expect(result.current.derived.secondary).toEqual({
      label: tr('setRow.weightIn', { unit: 'kg' }),
      value: tr('setRow.bodyweightShort'),
      a11y: tr('setRow.setWeight', { n: 3, weight: tr('setRow.bodyweight') }),
    });
  });

  it('shows a reps-only set as its reps alone', async () => {
    const { result } = await renderRow({ set: aRepsOnlySet({ index: 2, reps: 12 }) });

    expect(result.current.derived.primary).toEqual({
      label: tr('setRow.reps'),
      value: '12',
      a11y: tr('tracking.setReps', { n: 3, reps: 12 }),
    });
    expect(result.current.derived.secondary).toBeNull();
  });

  it('shows a timed set as its time, m:ss', async () => {
    const { result } = await renderRow({ set: aDurationSet({ index: 2, durationSeconds: 75 }) });

    expect(result.current.derived.primary).toEqual({
      label: tr('tracking.time'),
      value: '1:15',
      a11y: tr('tracking.setTime', { n: 3, time: '1:15' }),
    });
    expect(result.current.derived.secondary).toBeNull();
  });

  it('opens the set by its position', async () => {
    const { result, opened } = await renderRow();

    await act(async () => result.current.effects.open());

    expect(opened).toEqual([[1, 2]]);
  });

  it('toggles the set by its position', async () => {
    const { result, toggled } = await renderRow();

    await act(async () => result.current.effects.toggle());

    expect(toggled).toEqual([[1, 2]]);
  });
});
