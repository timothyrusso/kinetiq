import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { anEntry, anOpenSet, anotherEntry, aSession, aSet } from '@/features/workouts/__fixtures__/builders';
import { useExerciseEditor } from '@/features/workouts/hooks/useExerciseEditor';
import { useSessionStore } from '@/features/workouts/state/sessionStore';

const live = () => useSessionStore.getState().session;

/** A workout from a routine: both exercises and their sets carry the rows they were planned from. */
const fromRoutine = () =>
  aSession({
    routineItemIds: ['rit_bench', 'rit_press'],
    entries: [
      anEntry({
        routineItemId: 'rit_bench',
        sets: [aSet({ routineSetIndex: 0 }), anOpenSet({ index: 1, routineSetIndex: 1 })],
      }),
      anotherEntry({ routineItemId: 'rit_press' }),
    ],
  });

beforeEach(() => {
  resetAllStores();
  useSessionStore.getState().start(fromRoutine(), 1_000);
});

describe('useExerciseEditor', () => {
  it('reads the exercise the route names from the workout in progress', async () => {
    const { result } = await renderHook(() => useExerciseEditor(1));

    expect(result.current.entry?.exerciseName).toBe('Overhead Press');
    expect(result.current.entry?.sets).toHaveLength(3);
  });

  it('shows each set change at once, refreshing the estimate and keeping the routine row', async () => {
    const { result } = await renderHook(() => useExerciseEditor(0));

    await act(async () => result.current.changeSet(0, { reps: 3, weightKg: 110 }));

    expect(result.current.entry?.sets[0]).toMatchObject({
      reps: 3,
      weightKg: 110,
      completed: true,
      estimated1rm: 121,
      routineSetIndex: 0,
    });
    expect(live()?.entries[0]?.routineItemId).toBe('rit_bench');
  });

  it('adds a set with no routine row and removes one, keeping the rows of the rest', async () => {
    const { result } = await renderHook(() => useExerciseEditor(0));

    await act(async () => result.current.addSet());
    const added = result.current.entry?.sets[2];
    await act(async () => result.current.removeSet(0));

    expect(added).toMatchObject({ index: 2, reps: 5, weightKg: 100, completed: false });
    expect(added?.routineSetIndex).toBeUndefined();
    expect(result.current.entry?.sets.map(set => [set.index, set.routineSetIndex])).toEqual([
      [0, 1],
      [1, undefined],
    ]);
    expect(live()?.routineItemIds).toEqual(['rit_bench', 'rit_press']);
  });

  it('keeps the exercise’s last set', async () => {
    useSessionStore.getState().start(aSession({ entries: [anEntry({ sets: [aSet()] })] }), 1_000);
    const { result } = await renderHook(() => useExerciseEditor(0));

    await act(async () => result.current.removeSet(0));

    expect(result.current.entry?.sets).toHaveLength(1);
  });

  it('changes the exercise’s rest and note', async () => {
    const { result } = await renderHook(() => useExerciseEditor(1));

    await act(async () => result.current.changeEntry({ restSeconds: 120, notes: null }));

    expect(result.current.entry).toMatchObject({ restSeconds: 120, notes: null, routineItemId: 'rit_press' });
  });

  it('has no exercise for a position the workout does not have', async () => {
    const { result } = await renderHook(() => useExerciseEditor(4));

    expect(result.current.entry).toBeUndefined();
  });
});
