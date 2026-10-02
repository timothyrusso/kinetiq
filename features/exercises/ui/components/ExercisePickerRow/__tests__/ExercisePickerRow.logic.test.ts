import { act, renderHook } from '@testing-library/react-native';
import type { AccessibilityActionEvent } from 'react-native';
import { tr } from '@/features/core/translations';
import { anExercise } from '@/features/exercises/__fixtures__/builders';
import {
  type PickerRowState,
  useExercisePickerRowLogic,
} from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow.logic';

const SQUAT = anExercise({ id: 'ex:barbell-squat', name: 'Barbell Squat' });

const renderRow = async (state: Partial<PickerRowState> = {}) => {
  const onSelect = jest.fn();
  const onInfo = jest.fn();
  const rendered = await renderHook(() =>
    useExercisePickerRowLogic(SQUAT, onSelect, onInfo, {
      included: false,
      removable: true,
      locked: null,
      destination: 'routine',
      ...state,
    }),
  );
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

  it.each([
    [{ destination: 'routine' }, tr('states.addsToRoutine'), false, false],
    [{ destination: 'routine', included: true }, tr('states.removesFromRoutine'), true, false],
    [{ destination: 'workout' }, tr('states.addsToWorkout'), false, false],
    [{ destination: 'workout', included: true }, tr('states.removesFromWorkout'), true, false],
    [{ destination: 'workout', included: true, removable: false }, tr('states.alreadyInWorkout'), false, true],
    [{ destination: 'workout', included: true, locked: 'Has a logged set' }, 'Has a logged set', false, true],
  ] as const)('says what a tap does for %o', async (state, hint, selected, inert) => {
    const { result } = await renderRow(state);

    expect(result.current.derived).toMatchObject({ hint, selected, inert });
  });
});
