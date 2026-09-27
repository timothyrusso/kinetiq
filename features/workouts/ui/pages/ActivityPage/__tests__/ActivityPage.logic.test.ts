import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { EffectRuntimeProvider, type ProvidedRuntime } from '@timothyrusso/effect-core/react';
import { createElement, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { makeTestRuntime, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { aCompletedWorkout } from '@/features/workouts/__fixtures__/builders';
import { recordHistory, refuseWrites, storedActivity } from '@/features/workouts/di/__tests__/workoutsTestData';
import { WorkoutsTestLayer } from '@/features/workouts/di/__tests__/workoutsTestLayer';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { useActivityPageLogic } from '@/features/workouts/ui/pages/ActivityPage/ActivityPage.logic';

const ID = ActivityId.make('session-mbz1a2b3');
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const clients: QueryClient[] = [];
afterAll(() => {
  for (const client of clients) client.clear();
});

/**
 * Renders the page's ViewModel over the real workouts on a migrated in-memory database, inside a
 * safe area as the screen is: the content inset reads it. `recorded` writes the builder's workout
 * first.
 */
const renderPage = async ({ recorded = true, deleteFails = false } = {}) => {
  const { runtime } = makeTestRuntime(WorkoutsTestLayer);
  if (recorded) await recordHistory(runtime, [aCompletedWorkout()]);
  if (deleteFails) await refuseWrites(runtime, 'activities', 'DELETE');
  routerFake.setParams({ id: ID });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  // NOTE: the runtime provides the workouts and the core test services only, which is all this
  // page reads.
  const provided = runtime as unknown as ProvidedRuntime;
  const wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(
      SafeAreaProvider,
      { initialMetrics: METRICS },
      createElement(
        QueryClientProvider,
        { client },
        createElement(EffectRuntimeProvider, { runtime: provided }, children),
      ),
    );
  const rendered = await renderHook(useActivityPageLogic, { wrapper });
  await waitFor(() => expect(rendered.result.current.state.isLoading).toBe(false));
  const stored = () => storedActivity(runtime, ID);
  return { ...rendered, stored, done: () => runtime.dispose() };
};

describe('useActivityPageLogic', () => {
  it('reads the workout the route names and titles the screen with it', async () => {
    const { result, done } = await renderPage();

    expect(result.current.state.activity?.id).toBe(ID);
    expect(result.current.derived.title).toBe('Push Day');
    expect(result.current.derived.hero?.when).toHaveLength(2);
    await done();
  });

  it('fails with ActivityNotFound for a workout that is gone', async () => {
    const { result, done } = await renderPage({ recorded: false });

    expect(result.current.state.error?._tag).toBe('ActivityNotFound');
    expect(result.current.derived.title).toBe(tr('activity.fallbackTitle'));
    await done();
  });

  it('asks before deleting, naming the workout', async () => {
    const { result, done } = await renderPage();

    await act(async () => result.current.effects.askDelete());

    expect(result.current.state.confirmingDelete).toBe(true);
    expect(result.current.derived.deleteMessage).toBe(tr('activity.deleteMessage', { name: 'Push Day' }));
    await done();
  });

  it('deletes the workout and goes back once the delete has landed', async () => {
    const { result, stored, done } = await renderPage();
    await act(async () => result.current.effects.askDelete());

    await act(async () => result.current.effects.confirmDelete());

    await waitFor(() => expect(result.current.state.confirmingDelete).toBe(false));
    expect(await stored()).toBeUndefined();
    expect(routerFake.history).toEqual([{ verb: 'back', href: null }]);
    await done();
  });

  it('goes home after a delete when there is nothing to go back to', async () => {
    routerFake.setCanGoBack(false);
    const { result, done } = await renderPage();

    await act(async () => result.current.effects.confirmDelete());

    await waitFor(() => expect(routerFake.history).toEqual([{ verb: 'replace', href: '/' }]));
    await done();
  });

  it('keeps the dialog up with the reason when the delete fails, and the workout stays', async () => {
    const { result, stored, done } = await renderPage({ deleteFails: true });
    await act(async () => result.current.effects.askDelete());

    await act(async () => result.current.effects.confirmDelete());

    await waitFor(() => expect(result.current.derived.deleteMessage).toBe(tr('activity.deleteFailed')));
    expect(result.current.state.confirmingDelete).toBe(true);
    expect((await stored())?.id).toBe(ID);
    expect(routerFake.history).toEqual([]);
    await done();
  });

  it('forgets a failed delete when the dialog is closed', async () => {
    const { result, done } = await renderPage({ deleteFails: true });
    await act(async () => result.current.effects.askDelete());
    await act(async () => result.current.effects.confirmDelete());
    await waitFor(() => expect(result.current.derived.deleteMessage).toBe(tr('activity.deleteFailed')));

    await act(async () => result.current.effects.cancelDelete());

    expect(result.current.state.confirmingDelete).toBe(false);
    expect(result.current.derived.deleteMessage).toBe(tr('activity.deleteMessage', { name: 'Push Day' }));
    await done();
  });
});
