import { act, renderHook } from '@testing-library/react-native';
import { aDurationEntry, anEntry, anOpenSet, aRepsOnlyEntry, aSet } from '@/features/workouts/__fixtures__/builders';
import {
  type ExerciseBlockInput,
  useExerciseBlockLogic,
} from '@/features/workouts/ui/components/ExerciseBlock/ExerciseBlock.logic';

const renderBlock = async (overrides: Partial<ExerciseBlockInput> = {}) => {
  const presses: string[] = [];
  const input: ExerciseBlockInput = {
    entry: anEntry(),
    entryIndex: 3,
    previousLabel: null,
    previousWhen: null,
    onAddSet: index => void presses.push(`add ${index}`),
    onSkip: index => void presses.push(`skip ${index}`),
    onRequestRemove: index => void presses.push(`remove ${index}`),
    onOpen: index => void presses.push(`open ${index}`),
    ...overrides,
  };
  return { ...(await renderHook(() => useExerciseBlockLogic(input))), presses };
};

describe('useExerciseBlockLogic', () => {
  it('counts the completed sets and says when all are done', async () => {
    const { result } = await renderBlock();

    expect(result.current.derived.done).toBe(2);
    expect(result.current.derived.allDone).toBe(true);
  });

  it('is not all done while a set is open', async () => {
    const { result } = await renderBlock({ entry: anEntry({ sets: [aSet(), anOpenSet({ index: 1 })] }) });

    expect(result.current.derived.done).toBe(1);
    expect(result.current.derived.allDone).toBe(false);
  });

  it('is not all done with no sets at all', async () => {
    const { result } = await renderBlock({ entry: anEntry({ sets: [] }) });

    expect(result.current.derived.allDone).toBe(false);
  });

  it('has a cue only when the entry carries a note', async () => {
    const withNote = await renderBlock({ entry: anEntry({ notes: 'Pause at the chest' }) });
    const empty = await renderBlock({ entry: anEntry({ notes: '' }) });

    expect([withNote.result.current.derived.hasCue, empty.result.current.derived.hasCue]).toEqual([true, false]);
  });

  it('shows nothing about last time while the history has not answered', async () => {
    const { result } = await renderBlock();

    expect(result.current.derived.previous).toEqual([]);
  });

  it('shows the previous performance and when it was', async () => {
    const { result } = await renderBlock({ previousLabel: 'Last time 82.5 kg × 5', previousWhen: '3w ago' });

    expect(result.current.derived.previous).toEqual([
      { icon: 'dumbbell', label: 'Last time 82.5 kg × 5' },
      { icon: 'calendar', label: '3w ago' },
    ]);
  });

  it('marks last time with the icon of what the exercise records', async () => {
    const reps = await renderBlock({
      entry: aRepsOnlyEntry(),
      previousLabel: 'Last time 12 reps',
      previousWhen: '1w ago',
    });
    const timed = await renderBlock({
      entry: aDurationEntry(),
      previousLabel: 'Last time 1:30',
      previousWhen: '1w ago',
    });

    expect(reps.result.current.derived.previous[0]?.icon).toBe('refresh');
    expect(timed.result.current.derived.previous[0]?.icon).toBe('timer');
  });

  it('shows a previous label with no date as information', async () => {
    const { result } = await renderBlock({ previousLabel: 'No previous sessions yet' });

    expect(result.current.derived.previous).toEqual([{ icon: 'info', label: 'No previous sessions yet' }]);
  });

  it('hands its position to every press', async () => {
    const { result, presses } = await renderBlock();

    await act(async () => {
      result.current.effects.open();
      result.current.effects.addSet();
      result.current.effects.skip();
      result.current.effects.remove();
    });

    expect(presses).toEqual(['open 3', 'add 3', 'skip 3', 'remove 3']);
  });
});
