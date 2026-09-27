import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { HomeTestLayer } from '@/features/home/di/__tests__/homeTestLayer';
import { useStartEmptyWorkoutLogic } from '@/features/home/ui/components/StartEmptyWorkout/StartEmptyWorkout.logic';
import { useActiveSession } from '@/features/workouts';

beforeEach(() => {
  resetAllStores();
});

describe('useStartEmptyWorkoutLogic', () => {
  it('starts a workout with no exercises, named as an empty workout, then opens it', async () => {
    const started: string[] = [];
    const useButton = () => ({
      button: useStartEmptyWorkoutLogic(() => void started.push('opened')),
      live: useActiveSession(),
    });
    const { result, done } = await renderWithLayer(HomeTestLayer, useButton, undefined);

    await act(async () => result.current.button.effects.press());

    await waitFor(() => expect(started).toEqual(['opened']));
    expect(result.current.live.session?.routineName).toBe(tr('workoutTab.emptyWorkoutName'));
    expect(result.current.live.session?.entries).toEqual([]);
    await done();
  });
});
