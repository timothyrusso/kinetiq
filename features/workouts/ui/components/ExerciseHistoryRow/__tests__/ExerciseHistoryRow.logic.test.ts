import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import type { ExercisePerformance } from '@/features/workouts/domain/entities/ExerciseHistory';
import { useExerciseHistoryRowLogic } from '@/features/workouts/ui/components/ExerciseHistoryRow/ExerciseHistoryRow.logic';

const renderRow = async (overrides: Partial<ExercisePerformance> = {}) => {
  const opened: string[] = [];
  const session = aPerformance(overrides);
  return {
    ...(await renderHook(() => useExerciseHistoryRowLogic(session, 'metric', id => void opened.push(id)))),
    opened,
  };
};

describe('useExerciseHistoryRowLogic', () => {
  it('shows the top set as weight times reps', async () => {
    const { result } = await renderRow();

    expect(result.current.derived.load).toBe('100 kg × 5');
  });

  it('shows a bodyweight top set as reps only', async () => {
    const { result } = await renderRow({ topWeightKg: 0, topReps: 12 });

    expect(result.current.derived.load).toBe(tr('exerciseDetail.bodyweightTimes', { reps: 12 }));
  });

  it('shows a reps-only session by its most reps', async () => {
    const { result } = await renderRow({ trackingType: 'repsOnly', topWeightKg: 0, topReps: 15 });

    expect(result.current.derived.load).toBe(tr('details.repsValue', { reps: 15 }));
  });

  it('shows a timed session by its longest set, as m:ss', async () => {
    const { result } = await renderRow({
      trackingType: 'duration',
      topWeightKg: 0,
      topReps: 0,
      topDurationSeconds: 95,
    });

    expect(result.current.derived.load).toBe('1:35');
  });

  it('counts the sets when every one was done', async () => {
    const { result } = await renderRow();

    expect(result.current.derived.meta[1]).toEqual({ icon: 'layers', label: tr('workout.set', { count: 3 }) });
  });

  it('counts the sets done out of the planned ones', async () => {
    const { result } = await renderRow({ completedSets: 2 });

    expect(result.current.derived.meta[1]).toEqual({
      icon: 'layers',
      label: tr('details.setsOfTotal', { done: 2, total: 3 }),
    });
  });

  it('shows the estimated max when there is one', async () => {
    const { result } = await renderRow();

    expect(result.current.derived.estimate).toBe(tr('exerciseDetail.estSuffix', { value: '116.5 kg' }));
  });

  it('shows no estimate when no set supports one', async () => {
    const { result } = await renderRow({ estimated1rmKg: null });

    expect(result.current.derived.estimate).toBeNull();
  });

  it('opens the workout it came from', async () => {
    const { result, opened } = await renderRow();

    await act(async () => result.current.effects.open());

    expect(opened).toEqual(['session-mbz1a2b3']);
  });
});

function aPerformance(overrides: Partial<ExercisePerformance> = {}): ExercisePerformance {
  return {
    activityId: 'session-mbz1a2b3',
    performedAt: WORKOUT_TIME,
    exerciseName: 'Bench Press',
    trackingType: 'weightReps',
    volumeKg: 1500,
    sets: 3,
    completedSets: 3,
    topWeightKg: 100,
    topReps: 5,
    topDurationSeconds: 0,
    estimated1rmKg: 116.5,
    ...overrides,
  };
}
