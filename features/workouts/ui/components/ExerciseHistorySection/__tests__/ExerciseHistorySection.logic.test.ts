import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aCompletedWorkout, anEntry, aRecord, aSet, WORKOUT_TIME } from '@/features/workouts/__fixtures__/builders';
import { recordHistory } from '@/features/workouts/di/__tests__/workoutsTestData';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { renderWithWorkouts } from '@/features/workouts/facades/__tests__/renderWithWorkouts';
import { useExerciseHistorySectionLogic } from '@/features/workouts/ui/components/ExerciseHistorySection/ExerciseHistorySection.logic';

const WEEK = 7 * 86_400_000;

/**
 * Records `count` bench sessions a week apart, the load rising by 5 kg each time, then opens the
 * section on the bench press: it renders with no exercise first, so nothing is read before the
 * history exists.
 */
const renderHistory = async (count: number) => {
  const rendered = await renderWithWorkouts(useExerciseHistorySectionLogic, null as string | null);
  await recordHistory(
    rendered.runtime,
    Array.from({ length: count }, (_, index) =>
      aCompletedWorkout({
        id: ActivityId.make(`session-${index}`),
        startedAt: WORKOUT_TIME + index * WEEK,
        endedAt: WORKOUT_TIME + index * WEEK + 2_700_000,
        entries: [anEntry({ sets: [aSet({ weightKg: 100 + index * 5 })] })],
      }),
    ),
    count > 0 ? [aRecord()] : [],
  );
  await act(async () => rendered.rerender('wger:73'));
  await waitFor(() => expect(rendered.result.current.state.isLoading).toBe(false));
  return rendered;
};

describe('useExerciseHistorySectionLogic', () => {
  it('says the exercise was never logged when the history has none of it', async () => {
    const { result, done } = await renderHistory(0);

    expect(result.current.state.logged).toBe(false);
    expect(result.current.derived.lastPerformed).toBeNull();
    await done();
  });

  it('draws the heaviest set per session once there are two', async () => {
    const { result, done } = await renderHistory(2);

    expect(result.current.derived.showChart).toBe(true);
    expect(result.current.derived.chartPoints.map(point => point.value)).toEqual([100, 105]);
    expect(result.current.derived.chartA11y).toBe(
      tr('exerciseDetail.weightChartA11y', { count: 2, first: '100 kg', last: '105 kg' }),
    );
    await done();
  });

  it('draws no line for a single session', async () => {
    const { result, done } = await renderHistory(1);

    expect(result.current.state.logged).toBe(true);
    expect(result.current.derived.showChart).toBe(false);
    await done();
  });

  it('lists at most six sessions, newest first', async () => {
    const { result, done } = await renderHistory(8);

    expect(result.current.state.sessions.map(session => session.activityId)).toEqual([
      'session-7',
      'session-6',
      'session-5',
      'session-4',
      'session-3',
      'session-2',
    ]);
    await done();
  });

  it('shows the records held for the exercise', async () => {
    const { result, done } = await renderHistory(1);

    await waitFor(() =>
      expect(result.current.derived.recordRows).toEqual([
        { kind: 'est1rm', label: tr('records.est1rm'), value: '116.5 kg' },
      ]),
    );
    await done();
  });

  it('opens a session on its workout screen', async () => {
    const { result, done } = await renderHistory(1);

    await act(async () => result.current.effects.openSession('session-0'));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.activityDetail('session-0') }]);
    await done();
  });
});
