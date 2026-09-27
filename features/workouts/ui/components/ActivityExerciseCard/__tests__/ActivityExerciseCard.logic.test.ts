import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { anEntry, anOpenSet, aSet } from '@/features/workouts/__fixtures__/builders';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { useActivityExerciseCardLogic } from '@/features/workouts/ui/components/ActivityExerciseCard/ActivityExerciseCard.logic';

const renderCard = async (entry: StrengthEntry = anEntry()) => {
  const opened: string[] = [];
  const rendered = await renderHook(() => useActivityExerciseCardLogic(entry, 'metric', id => void opened.push(id)));
  return { ...rendered, opened };
};

describe('useActivityExerciseCardLogic', () => {
  it('counts the sets done and names the heaviest completed one', async () => {
    const entry = anEntry({
      sets: [aSet(), aSet({ index: 1, weightKg: 110, estimated1rm: 128.3 }), anOpenSet({ index: 2 })],
    });

    const { result } = await renderCard(entry);

    expect(result.current.derived.meta).toEqual([
      { icon: 'layers', label: `2/3 ${tr('activity.setWord', { count: 3 })}` },
      { icon: 'trophy', label: tr('activity.topSet', { weight: '110 kg', reps: 5 }) },
    ]);
  });

  it('names no top set when nothing was completed', async () => {
    const { result } = await renderCard(anEntry({ sets: [anOpenSet()] }));

    expect(result.current.derived.meta).toHaveLength(1);
  });

  it('badges a workout with every set done', async () => {
    const { result } = await renderCard();

    expect(result.current.derived.badge).toEqual({ label: tr('activity.allDone'), tone: 'success' });
  });

  it('badges an exercise with no set done as skipped', async () => {
    const { result } = await renderCard(anEntry({ sets: [anOpenSet()] }));

    expect(result.current.derived.badge).toEqual({ label: tr('activity.skipped'), tone: 'warning' });
  });

  it('badges a partly done exercise with its count', async () => {
    const { result } = await renderCard(anEntry({ sets: [aSet(), anOpenSet({ index: 1 })] }));

    expect(result.current.derived.badge).toEqual({ label: '1/2', tone: 'neutral' });
  });

  it('shows a set with no load as bodyweight and no estimated max', async () => {
    const { result } = await renderCard(anEntry({ sets: [aSet({ weightKg: 0, reps: 20, estimated1rm: null })] }));

    expect(result.current.derived.sets[0]).toMatchObject({
      weight: tr('activity.bodyweightShort'),
      oneRepMax: '-',
    });
  });

  it('recomputes the estimate a row written before the field existed lacks', async () => {
    const { result } = await renderCard(anEntry({ sets: [aSet({ estimated1rm: null })] }));

    expect(result.current.derived.sets[0]?.oneRepMax).not.toBe('-');
  });

  it('speaks an open set as not done', async () => {
    const { result } = await renderCard(anEntry({ sets: [anOpenSet()] }));

    expect(result.current.derived.sets[0]?.accessibilityLabel).toBe(tr('activity.setNotDone', { n: 1 }));
  });

  it('tags the muscle group a legacy entry carries', async () => {
    const { result } = await renderCard(anEntry({ muscleGroup: 'Chest' }));

    expect(result.current.derived.tags).toEqual([{ key: 'muscle', label: 'Chest' }]);
  });

  it('opens the exercise by its id', async () => {
    const { result, opened } = await renderCard();

    await act(async () => result.current.effects.open());

    expect(opened).toEqual(['wger:73']);
  });
});
