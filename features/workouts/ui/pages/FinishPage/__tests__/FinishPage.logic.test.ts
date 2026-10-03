import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import { storedActivity } from '@/features/workouts/di/__tests__/workoutsTestData';
import { routinesUpdated, WorkoutsTestLayer } from '@/features/workouts/di/__tests__/workoutsTestLayer';
import type { WorkoutSession } from '@/features/workouts/domain/schemas/WorkoutSessionSchema';
import { sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useFinishPageLogic } from '@/features/workouts/ui/pages/FinishPage/FinishPage.logic';

const FROM_ROUTINE = aSession({ routineItemIds: ['rit_bench', 'rit_press'] });

beforeEach(() => {
  resetAllStores();
  routinesUpdated.length = 0;
});

/** The finish sheet over `session`, the workout in progress. */
const renderSheet = async (session: WorkoutSession) => {
  sessionLifecycle.restore(session);
  return renderWithLayer(WorkoutsTestLayer, useFinishPageLogic, undefined);
};

describe('useFinishPageLogic', () => {
  it('offers the routine switch, on, for a workout from a routine', async () => {
    const { result, done } = await renderSheet(FROM_ROUTINE);

    expect(result.current.derived.showRoutineSwitch).toBe(true);
    expect(result.current.state.updateRoutine).toBe(true);
    await done();
  });

  it('finishes into history, writes the workout back into its routine and goes Home', async () => {
    const { result, runtime, done } = await renderSheet(FROM_ROUTINE);

    await act(async () => result.current.effects.finish());

    await waitFor(() => expect(routerFake.history[0]).toEqual({ verb: 'dismissTo', href: routes.home() }));
    expect((await storedActivity(runtime, FROM_ROUTINE.id))?.title).toBe('Push Day');
    expect(routinesUpdated.map(update => update.routineId)).toEqual(['rtn_push']);
    await done();
  });

  it('leaves the routine alone with the switch turned off', async () => {
    const { result, runtime, done } = await renderSheet(FROM_ROUTINE);

    await act(async () => result.current.effects.setUpdateRoutine(false));
    await act(async () => result.current.effects.finish());

    await waitFor(() => expect(routerFake.history[0]).toEqual({ verb: 'dismissTo', href: routes.home() }));
    expect((await storedActivity(runtime, FROM_ROUTINE.id))?.title).toBe('Push Day');
    expect(routinesUpdated).toEqual([]);
    await done();
  });

  it('hides the switch, off, for a workout that did not start from a routine', async () => {
    const { result, done } = await renderSheet(aSession({ routineId: null }));

    expect(result.current.derived.showRoutineSwitch).toBe(false);
    expect(result.current.state.updateRoutine).toBe(false);
    await act(async () => result.current.effects.finish());

    await waitFor(() => expect(routerFake.history[0]).toEqual({ verb: 'dismissTo', href: routes.home() }));
    expect(routinesUpdated).toEqual([]);
    await done();
  });

  it('hides the switch for a workout started before it knew its routine items', async () => {
    const { result, done } = await renderSheet(aSession());

    expect(result.current.derived.showRoutineSwitch).toBe(false);
    await done();
  });

  it('finishes a workout with every exercise removed like an empty one, leaving its routine alone', async () => {
    const emptied = aSession({ routineItemIds: ['rit_bench', 'rit_press'], entries: [] });
    const { result, runtime, done } = await renderSheet(emptied);

    expect(result.current.derived.message).toBe(tr('session.finishEmpty'));
    expect(result.current.derived.showRoutineSwitch).toBe(false);
    await act(async () => result.current.effects.finish());

    await waitFor(() => expect(routerFake.history[0]).toEqual({ verb: 'dismissTo', href: routes.home() }));
    expect((await storedActivity(runtime, emptied.id))?.title).toBe('Push Day');
    expect(routinesUpdated).toEqual([]);
    await done();
  });
});
