import { act, renderHook } from '@testing-library/react-native';
import type { AccessibilityActionEvent } from 'react-native';
import { tr } from '@/features/core/translations';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import { useExercisePickerRowLogic } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.logic';

const SQUAT = anExercise({ id: 'ex:barbell-squat', name: 'Barbell Squat' });

const renderRow = async () => {
  const onSelect = jest.fn();
  const onInfo = jest.fn();
  const rendered = await renderHook(() => useExercisePickerRowLogic(SQUAT, onSelect, onInfo));
  return { ...rendered, onSelect, onInfo };
};

describe('useExercisePickerRowLogic', () => {
  it('adds on the row and opens the page on the info button, each with the id', async () => {
    const { result, onSelect, onInfo } = await renderRow();

    await act(async () => result.current.effects.select());
    await act(async () => result.current.effects.info());

    expect(onSelect).toHaveBeenCalledWith('ex:barbell-squat');
    expect(onInfo).toHaveBeenCalledWith('ex:barbell-squat');
  });

  it('offers the info button to a screen reader as the row’s named action', async () => {
    const { result, onInfo, onSelect } = await renderRow();

    expect(result.current.derived.infoLabel).toBe(tr('exerciseDetail.openA11y', { name: 'Barbell Squat' }));
    expect(result.current.derived.accessibilityActions).toEqual([
      { name: 'info', label: result.current.derived.infoLabel },
    ]);
    await act(async () =>
      result.current.effects.onAccessibilityAction({ nativeEvent: { actionName: 'info' } } as AccessibilityActionEvent),
    );
    expect(onInfo).toHaveBeenCalledWith('ex:barbell-squat');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps its handlers across renders, so the memoised row is not redrawn', async () => {
    const { result, rerender } = await renderRow();
    const first = result.current.effects;

    await rerender({});

    expect(result.current.effects.info).toBe(first.info);
    expect(result.current.effects.select).toBe(first.select);
  });
});
