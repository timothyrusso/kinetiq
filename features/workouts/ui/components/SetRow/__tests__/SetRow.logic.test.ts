import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { aSet } from '@/features/workouts/__fixtures__/builders';
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
  it('numbers the set from one and shows its weight in the user units', async () => {
    const { result } = await renderRow({ units: 'imperial' });

    expect(result.current.derived.number).toBe(3);
    expect(result.current.derived.weightText).toBe('220 lb');
  });

  it('shows a set with no load as bodyweight', async () => {
    const { result } = await renderRow({ set: aSet({ weightKg: 0 }) });

    expect(result.current.derived.weightText).toBe(tr('setRow.bodyweight'));
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
