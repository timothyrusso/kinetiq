import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { aPlan } from '@/features/workouts/__fixtures__/builders';
import { routinesUsed } from '@/features/workouts/di/__tests__/workoutsTestLayer';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { renderWithWorkouts } from '@/features/workouts/facades/__tests__/renderWithWorkouts';
import { sessionActions, useActiveSession, useWorkoutRunning } from '@/features/workouts/facades/useActiveSession';
import { useActivities, useActivity, useDeleteActivity } from '@/features/workouts/facades/useActivities';
import { useDiscardSession } from '@/features/workouts/facades/useDiscardSession';
import { useExerciseHistory } from '@/features/workouts/facades/useExerciseHistory';
import { useFinishSession } from '@/features/workouts/facades/useFinishSession';
import { useTrainingSummary } from '@/features/workouts/facades/useProgress';
import { useStartSession } from '@/features/workouts/facades/useStartSession';

interface Opened {
  readonly activityId: ActivityId | null;
  readonly exerciseId: string | null;
}

const NOTHING_OPEN: Opened = { activityId: null, exerciseId: null };

/** The player and the history, in one component like the session screen over Home. */
const useWorkoutScreens = ({ activityId, exerciseId }: Opened) => ({
  live: useActiveSession(),
  running: useWorkoutRunning(),
  starter: useStartSession(),
  finish: useFinishSession(),
  discard: useDiscardSession(),
  history: useActivities(),
  detail: useActivity(activityId),
  remove: useDeleteActivity(),
  exercise: useExerciseHistory(exerciseId),
  summary: useTrainingSummary(1),
});

type Screens = ReturnType<typeof useWorkoutScreens>;

/** Starts the builder's plan and waits for the session to be live. */
const startPlan = async (current: { current: Screens }) => {
  await act(async () => current.current.starter.start(aPlan()));
  await waitFor(() => expect(current.current.live.session).not.toBeNull());
};

/** Ticks the first set of the bench press and records the workout. */
const tickAndFinish = async (current: { current: Screens }) => {
  await act(async () => void sessionActions.toggleSet(0, 0));
  const session = current.current.live.session;
  if (session === null) throw new Error('no session to finish');
  await act(
    async () => void (await current.current.finish.mutateAsync({ id: session.id, routineId: session.routineId })),
  );
};

beforeEach(() => {
  resetAllStores();
  routinesUsed.length = 0;
});

describe('the workout facades', () => {
  it('starts with an empty history that says it is empty', async () => {
    const { result, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);

    await waitFor(() => expect(result.current.history.isEmpty).toBe(true));
    expect(result.current.running).toBe(false);
    await done();
  });

  it('starts a workout from a plan, which is then running', async () => {
    const { result, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);

    await startPlan(result);

    expect(result.current.running).toBe(true);
    expect(result.current.live.session?.entries.map(entry => entry.exerciseName)).toEqual([
      'Bench Press',
      'Overhead Press',
    ]);
    await done();
  });

  it('refuses a second workout while one runs, as SessionAlreadyActive', async () => {
    const { result, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);
    await startPlan(result);
    const first = result.current.live.session?.id;

    await act(async () => result.current.starter.start(aPlan({ name: 'Leg Day' })));

    await waitFor(() => expect(result.current.starter.error?._tag).toBe('SessionAlreadyActive'));
    expect(result.current.live.session?.id).toBe(first);
    await done();
  });

  it('records a finished workout, lets the session go and shows it in the history', async () => {
    const { result, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);
    await waitFor(() => expect(result.current.history.isLoading).toBe(false));
    await startPlan(result);

    await tickAndFinish(result);

    await waitFor(() =>
      expect(result.current.history.activities.map(activity => activity.title)).toEqual(['Push Day']),
    );
    expect(result.current.live.session).toBeNull();
    expect(result.current.running).toBe(false);
    expect(routinesUsed).toEqual(['rtn_push']);
    await done();
  });

  it('refreshes the week’s summary after a finish', async () => {
    const { result, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);
    await waitFor(() => expect(result.current.summary.data?.hasAnyHistory).toBe(false));
    await startPlan(result);

    await tickAndFinish(result);

    await waitFor(() => expect(result.current.summary.data?.hasAnyHistory).toBe(true));
    await done();
  });

  it('shows a finished workout in its exercise’s history, with the record it set', async () => {
    const { result, rerender, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);
    await startPlan(result);
    await tickAndFinish(result);

    await rerender({ ...NOTHING_OPEN, exerciseId: 'wger:73' });

    await waitFor(() => expect(result.current.exercise.history.sessionsCount).toBe(1));
    expect(result.current.exercise.records.map(record => record.kind)).toEqual(['est1rm', 'maxReps']);
    await done();
  });

  it('reads a finished workout by id, and deletes it from the history', async () => {
    const { result, rerender, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);
    await startPlan(result);
    const id = result.current.live.session?.id ?? null;
    await tickAndFinish(result);

    await rerender({ ...NOTHING_OPEN, activityId: id });
    await waitFor(() => expect(result.current.detail.data?.title).toBe('Push Day'));
    await act(async () => void (await result.current.remove.mutateAsync(id ?? ActivityId.make('none'))));

    await waitFor(() => expect(result.current.history.isEmpty).toBe(true));
    await done();
  });

  it('hands a workout that is gone to the screen as ActivityNotFound', async () => {
    const { result, done } = await renderWithWorkouts(useWorkoutScreens, {
      ...NOTHING_OPEN,
      activityId: ActivityId.make('session-gone'),
    });

    await waitFor(() => expect(result.current.detail.error?._tag).toBe('ActivityNotFound'));
    await done();
  });

  it('discards a workout without recording it', async () => {
    const { result, done } = await renderWithWorkouts(useWorkoutScreens, NOTHING_OPEN);
    await startPlan(result);
    const id = result.current.live.session?.id ?? ActivityId.make('none');

    await act(async () => void (await result.current.discard.mutateAsync(id)));

    expect(result.current.live.session).toBeNull();
    await waitFor(() => expect(result.current.history.isEmpty).toBe(true));
    await done();
  });
});
