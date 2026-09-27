import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { HomeTestLayer, seedRoutine, trainRoutine } from '@/features/home/di/__tests__/homeTestLayer';
import { useWorkoutTabPageLogic } from '@/features/home/ui/pages/WorkoutTabPage/WorkoutTabPage.logic';

beforeEach(() => {
  resetAllStores();
});

const renderTab = async () => {
  const rendered = await renderWithLayer(HomeTestLayer, useWorkoutTabPageLogic, undefined);
  await waitFor(() => expect(rendered.result.current.state.isLoading).toBe(false));
  return rendered;
};

describe('useWorkoutTabPageLogic', () => {
  it('says there are no routines yet, with no order control', async () => {
    const { result, done } = await renderTab();

    expect(result.current.state.isEmpty).toBe(true);
    expect(result.current.state.showOrder).toBe(false);
    expect(result.current.state.resuming).toBe(false);
    await done();
  });

  it('orders by most recently trained, with never-trained routines last', async () => {
    const { result, runtime, done } = await renderTab();
    await act(async () => {
      await runtime.runPromise(seedRoutine('Legs'));
      await runtime.runPromise(trainRoutine(await runtime.runPromise(seedRoutine('Push')), 1_000));
      await runtime.runPromise(trainRoutine(await runtime.runPromise(seedRoutine('Pull')), 2_000));
    });

    await act(async () => result.current.effects.retry());

    await waitFor(() =>
      expect(result.current.state.sorted.map(routine => routine.name)).toEqual(['Pull', 'Push', 'Legs']),
    );
    expect(result.current.state.count).toBe(3);
    expect(result.current.state.showOrder).toBe(true);
    await done();
  });

  it('orders by name, ignoring case, once the user picks it', async () => {
    const { result, runtime, done } = await renderTab();
    await act(async () => {
      await runtime.runPromise(seedRoutine('push'));
      await runtime.runPromise(seedRoutine('Arms'));
    });
    await act(async () => result.current.effects.retry());
    await waitFor(() => expect(result.current.state.count).toBe(2));

    await act(async () => result.current.effects.setOrder('name'));

    expect(result.current.state.sorted.map(routine => routine.name)).toEqual(['Arms', 'push']);
    await done();
  });

  it('opens a routine by its id', async () => {
    const { result, done } = await renderTab();

    await act(async () => result.current.effects.openRoutine('rtn_push'));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.routine('rtn_push') }]);
    await done();
  });

  it('opens the routine builder', async () => {
    const { result, done } = await renderTab();

    await act(async () => result.current.effects.openNewRoutine());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.newRoutine() }]);
    await done();
  });

  it('opens the session player', async () => {
    const { result, done } = await renderTab();

    await act(async () => result.current.effects.openSession());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.workoutSession() }]);
    await done();
  });

  it('labels the order segments in the app language', async () => {
    const { result, done } = await renderTab();

    expect(result.current.derived.orderSegments.map(segment => segment.label)).toEqual([
      tr('workoutTab.orderRecent'),
      tr('workoutTab.orderName'),
    ]);
    await done();
  });
});
