import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { anEntry, anotherEntry, aSession } from '@/features/workouts/__fixtures__/builders';
import { sessionActions, sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useRemoveSessionExercise } from '@/features/workouts/facades/useRemoveSessionExercise';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

const live = () => useSessionStore.getState().session;

beforeEach(() => {
  resetAllStores();
  sessionLifecycle.restore(aSession({ routineItemIds: ['rit_bench', 'rit_press'] }));
});

describe('useRemoveSessionExercise', () => {
  it('removes an exercise with no completed set, keeping the items the workout started with', async () => {
    const { result } = await renderHook(useRemoveSessionExercise);

    const kind = result.current.removalOf('ex:barbell-squat');
    let removed = false;
    await act(async () => {
      removed = result.current.remove('ex:barbell-squat');
    });

    expect(kind).toBe('removable');
    expect(removed).toBe(true);
    expect(live()?.entries.map(entry => entry.exerciseId)).toEqual(['ex:barbell-bench-press']);
    expect(live()?.routineItemIds).toEqual(['rit_bench', 'rit_press']);
  });

  it('keeps an exercise with a completed set', async () => {
    const { result } = await renderHook(useRemoveSessionExercise);

    let removed = true;
    await act(async () => {
      removed = result.current.remove('ex:barbell-bench-press');
    });

    expect(result.current.removalOf('ex:barbell-bench-press')).toBe('hasCompletedSet');
    expect(removed).toBe(false);
    expect(live()?.entries).toHaveLength(2);
  });

  it('keeps the workout’s last exercise', async () => {
    sessionLifecycle.restore(aSession({ entries: [anotherEntry()] }));
    const { result } = await renderHook(useRemoveSessionExercise);

    let removed = true;
    await act(async () => {
      removed = result.current.remove('ex:barbell-squat');
    });

    expect(result.current.removalOf('ex:barbell-squat')).toBe('lastExercise');
    expect(removed).toBe(false);
    expect(live()?.entries).toHaveLength(1);
  });

  it('judges the workout as it is when tapped, not as it was drawn', async () => {
    const { result } = await renderHook(useRemoveSessionExercise);
    const drawn = result.current.removalOf('ex:barbell-squat');

    sessionActions.toggleSet(1, 0);
    let removed = true;
    await act(async () => {
      removed = result.current.remove('ex:barbell-squat');
    });

    expect(drawn).toBe('removable');
    expect(removed).toBe(false);
    expect(result.current.removalOf('ex:barbell-squat')).toBe('hasCompletedSet');
  });

  it('keeps the current exercise current when the picker removes one above it', async () => {
    sessionLifecycle.restore(
      aSession({ entries: [anotherEntry(), anEntry({ exerciseId: 'ex:pullups' })], activeIndex: 1 }),
    );
    const { result } = await renderHook(useRemoveSessionExercise);

    await act(async () => void result.current.remove('ex:barbell-squat'));

    expect(live()?.activeIndex).toBe(0);
    expect(live()?.entries[0]?.exerciseId).toBe('ex:pullups');
  });
});
