import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { spacing } from '@/features/core/theme';
import { updateSettings } from '@/features/settings';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import { makeSessionScreenTestLayer } from '@/features/workouts/di/__tests__/workoutsTestData';
import { sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useSessionPageLogic } from '@/features/workouts/ui/pages/SessionPage/SessionPage.logic';

beforeEach(() => {
  resetAllStores();
});

/** The live workout screen over the builder's open push day. */
const renderScreen = async (session = aSession()) => {
  sessionLifecycle.restore(session);
  const test = makeSessionScreenTestLayer();
  const rendered = await renderWithLayer(test.layer, useSessionPageLogic, undefined);
  return { ...rendered, screen: test.screen };
};

describe('useSessionPageLogic', () => {
  it('draws one block per exercise, the first one current', async () => {
    const { result, done } = await renderScreen();

    expect(result.current.derived.blocks.map(block => block.isCurrent)).toEqual([true, false]);
    await done();
  });

  it('keeps the screen on while the workout is open', async () => {
    const { screen, done } = await renderScreen();

    await waitFor(() => expect(screen.awake).toBe(true));
    await done();
  });

  it('lets the screen sleep when the screen is left', async () => {
    const { screen, done } = await renderScreen();
    await waitFor(() => expect(screen.awake).toBe(true));

    await done();

    expect(screen.awake).toBe(false);
  });

  it('leaves the screen alone when keep screen on is off', async () => {
    updateSettings({ keepScreenAwake: false });
    const { screen, done } = await renderScreen();

    await act(async () => undefined);

    expect(screen.awake).toBe(false);
    await done();
  });

  it('pauses a running workout and resumes it', async () => {
    const { result, done } = await renderScreen();

    await act(async () => result.current.effects.togglePause());
    const paused = result.current.derived.running;
    await act(async () => result.current.effects.togglePause());

    expect(paused).toBe(false);
    expect(result.current.derived.running).toBe(true);
    await done();
  });

  it('asks before discarding and backs out without losing anything', async () => {
    const { result, done } = await renderScreen();

    await act(async () => result.current.effects.askDiscard());
    const asked = result.current.state.confirmDiscard;
    await act(async () => result.current.effects.cancelDiscard());

    expect(asked).toBe(true);
    expect(result.current.state.confirmDiscard).toBe(false);
    expect(result.current.state.session).not.toBeNull();
    await done();
  });

  it('opens the set editor for a set and makes its exercise current', async () => {
    const { result, done } = await renderScreen();

    await act(async () => result.current.effects.openSet(1, 0));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.sessionSet(1, 0) }]);
    expect(result.current.derived.blocks.map(block => block.isCurrent)).toEqual([false, true]);
    await done();
  });

  it('asks to finish in the finish sheet', async () => {
    const { result, done } = await renderScreen();

    await act(async () => result.current.effects.askFinish());

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.sessionFinish() }]);
    expect(result.current.state.session).not.toBeNull();
    await done();
  });

  it('stands the rest dock on the footer, so Finish and Discard stay reachable', async () => {
    const { result, done } = await renderScreen(aSession({ restEndsAt: Date.now() + 60_000, restDurationSeconds: 90 }));
    const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } }) as never;

    await act(async () => result.current.effects.footerLayout(layout(110.4)));
    await act(async () => result.current.effects.dockHeight(72));

    expect(result.current.derived.restShown).toBe(true);
    expect(result.current.derived.dockBottom).toBe(110 + spacing.sm);
    expect(result.current.derived.contentInset).toEqual({ paddingBottom: 110 + spacing.sm + 72 + spacing.xl });
    await done();
  });
});
