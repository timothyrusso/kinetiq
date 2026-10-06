import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { joinMiddleDot } from '@/features/core/utils';
import {
  aDurationEntry,
  aDurationSet,
  anEntry,
  anOpenSet,
  aRepsOnlyEntry,
  aRepsOnlySet,
  aSet,
} from '@/features/workouts/__fixtures__/builders';
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

  it('heads a loaded exercise with weight, reps and the estimated max', async () => {
    const { result } = await renderCard();

    expect(result.current.derived.columns).toEqual({
      weight: 'activity.colKg',
      value: 'activity.colReps',
      estimate: true,
    });
    expect(result.current.derived.sets[0]).toMatchObject({ weight: '100 kg', value: '5' });
  });

  it('draws a reps-only exercise as reps alone, with its most reps as the top set', async () => {
    const entry = aRepsOnlyEntry({ sets: [aRepsOnlySet({ reps: 10 }), aRepsOnlySet({ index: 1, reps: 14 })] });

    const { result } = await renderCard(entry);

    expect(result.current.derived.columns).toEqual({ weight: null, value: 'activity.colReps', estimate: false });
    expect(result.current.derived.meta[1]).toEqual({ icon: 'trophy', label: tr('tracking.topReps', { reps: 14 }) });
    expect(result.current.derived.sets[1]).toMatchObject({
      weight: null,
      value: '14',
      oneRepMax: null,
      accessibilityLabel: joinMiddleDot([
        tr('activity.setNumber', { n: 2 }),
        `14 ${tr('activity.repWord', { count: 14 })}`,
      ]),
    });
  });

  it('draws a timed exercise as its time per set, with the longest as the top set', async () => {
    const entry = aDurationEntry({
      sets: [aDurationSet({ durationSeconds: 75 }), aDurationSet({ index: 1, durationSeconds: 60 })],
    });

    const { result } = await renderCard(entry);

    expect(result.current.derived.columns).toEqual({ weight: null, value: 'tracking.colTime', estimate: false });
    expect(result.current.derived.meta[1]).toEqual({ icon: 'trophy', label: tr('tracking.topTime', { time: '1:15' }) });
    expect(result.current.derived.sets.map(set => set.value)).toEqual(['1:15', '1:00']);
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

  it('shows the RPE noted on a set and nothing on a set noted as 0', async () => {
    const { result } = await renderCard(anEntry({ sets: [aSet({ rpe: 8 }), aSet({ index: 1, rpe: 0 })] }));

    expect(result.current.derived.hasRpe).toBe(true);
    expect(result.current.derived.sets.map(set => set.rpe)).toEqual(['8', '']);
    expect(result.current.derived.sets[0]?.accessibilityLabel).toContain(tr('activity.rpeValue', { value: '8' }));
    expect(result.current.derived.sets[1]?.accessibilityLabel).not.toContain(tr('activity.colRpe'));
  });

  it('leaves out the RPE column when no set has one noted', async () => {
    const { result } = await renderCard(anEntry({ sets: [aSet(), aSet({ index: 1, rpe: 0 })] }));

    expect(result.current.derived.hasRpe).toBe(false);
  });

  it('shows no RPE on a set not done, whose value is only the target', async () => {
    const { result } = await renderCard(anEntry({ sets: [anOpenSet({ rpe: 7 })] }));

    expect(result.current.derived.hasRpe).toBe(false);
    expect(result.current.derived.sets[0]?.rpe).toBe('');
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

    expect(opened).toEqual(['ex:barbell-bench-press']);
  });
});
