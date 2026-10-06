import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { HomeTestLayer, recordWorkout } from '@/features/home/di/__tests__/homeTestLayer';
import { useHomePageLogic } from '@/features/home/ui/pages/HomePage/HomePage.logic';

beforeEach(() => {
  resetAllStores();
});

/** Renders Home and waits for the history and the grid to settle. */
const renderHome = async () => {
  const rendered = await renderWithLayer(HomeTestLayer, useHomePageLogic, undefined);
  await waitFor(() => expect(rendered.result.current.state.historyLoading).toBe(false));
  await waitFor(() => expect(rendered.result.current.state.heatmapPending).toBe(false));
  return rendered;
};

/** Renders Home over a history holding one recorded push day. */
const renderWithWorkout = async () => {
  const rendered = await renderHome();
  await act(async () => void (await rendered.runtime.runPromise(recordWorkout)));
  await act(async () => rendered.result.current.effects.refresh());
  await waitFor(() => expect(rendered.result.current.state.rows).toHaveLength(2));
  return rendered;
};

describe('useHomePageLogic', () => {
  it('says the history is empty when nothing was recorded', async () => {
    const { result, done } = await renderHome();

    await waitFor(() => expect(result.current.state.historyEmpty).toBe(true));
    expect(result.current.state.rows).toEqual([]);
    expect(result.current.derived.title).toBe(tr('tabs.home'));
    await done();
  });

  it('lists a workout under the heading of its week', async () => {
    const { result, done } = await renderWithWorkout();

    const [heading, row] = result.current.state.rows;
    expect(heading).toMatchObject({ type: 'week', count: 1, first: true });
    expect(row?.type === 'workout' && row.activity.title).toBe('Push Day');
    await done();
  });

  it('asks before deleting, naming the workout', async () => {
    const { result, done } = await renderWithWorkout();

    await act(async () => result.current.effects.askDelete('session-home-1'));

    expect(result.current.state.pendingDelete?.title).toBe('Push Day');
    expect(result.current.derived.deleteMessage).toBe(tr('activity.deleteMessage', { name: 'Push Day' }));
    await done();
  });

  it('deletes the workout on confirm and closes the dialog', async () => {
    const { result, done } = await renderWithWorkout();
    await act(async () => result.current.effects.askDelete('session-home-1'));

    await act(async () => result.current.effects.confirmDelete());

    await waitFor(() => expect(result.current.state.pendingDelete).toBeNull());
    await waitFor(() => expect(result.current.state.historyEmpty).toBe(true));
    await done();
  });

  it('keeps the workout when the dialog is cancelled', async () => {
    const { result, done } = await renderWithWorkout();
    await act(async () => result.current.effects.askDelete('session-home-1'));

    await act(async () => result.current.effects.cancelDelete());

    expect(result.current.state.pendingDelete).toBeNull();
    expect(result.current.state.rows).toHaveLength(2);
    await done();
  });

  it('has nothing to confirm when no workout is pending', async () => {
    const { result, done } = await renderWithWorkout();

    await act(async () => result.current.effects.confirmDelete());

    expect(result.current.state.deleting).toBe(false);
    expect(result.current.state.rows).toHaveLength(2);
    await done();
  });

  it('opens a workout by its id', async () => {
    const { result, done } = await renderHome();

    await act(async () => result.current.effects.openActivity('session-home-1'));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.activityDetail('session-home-1') }]);
    await done();
  });

  it('sends the empty state straight to the new-routine editor', async () => {
    const { result, done } = await renderHome();

    await act(async () => result.current.effects.openNewRoutine());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.newRoutine() }]);
    await done();
  });

  it('reads the training grid for the weeks it draws', async () => {
    const { result, done } = await renderHome();

    await act(async () => result.current.effects.retrySummary());

    await waitFor(() => expect(result.current.state.heatmapPending).toBe(false));
    expect(result.current.state.heatmap?.days).toHaveLength(result.current.state.gridWeeks * 7);
    expect(result.current.state.heatmapError).toBeNull();
    await done();
  });
});
