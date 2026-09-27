import { act, renderHook } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aSession, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useWorkoutAccessoryLogic } from '@/features/workouts/ui/pages/WorkoutAccessory/WorkoutAccessory.logic';

beforeEach(() => {
  resetAllStores();
});

describe('useWorkoutAccessoryLogic', () => {
  it('shows nothing when no workout is in progress', async () => {
    const { result } = await renderHook(useWorkoutAccessoryLogic);

    expect(result.current.derived).toEqual({ label: null, detail: '' });
  });

  it('names the running workout and shows its clock', async () => {
    const { result } = await renderHook(useWorkoutAccessoryLogic);

    await act(async () => sessionLifecycle.restore(aSession()));

    expect(result.current.derived).toEqual({ label: 'Push Day', detail: '10:00' });
  });

  it('says a paused workout is paused instead of showing its clock', async () => {
    const { result } = await renderHook(useWorkoutAccessoryLogic);

    await act(async () => sessionLifecycle.restore(aSession({ status: 'paused' })));

    expect(result.current.derived.detail).toBe(tr('workout.paused'));
  });

  it('shows nothing for a workout that has finished', async () => {
    const { result } = await renderHook(useWorkoutAccessoryLogic);

    await act(async () => sessionLifecycle.restore(aSession({ status: 'finished', updatedAt: WORKOUT_TIME })));

    expect(result.current.derived.label).toBeNull();
  });

  it('opens the workout screen', async () => {
    const { result } = await renderHook(useWorkoutAccessoryLogic);

    await act(async () => result.current.effects.open());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.workoutSession() }]);
  });
});
