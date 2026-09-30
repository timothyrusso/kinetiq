import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { spacing } from '@/features/core/theme';
import { tr } from '@/features/core/translations';
import { getSettings, updateSettings } from '@/features/settings';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import { makeSessionScreenTestLayer } from '@/features/workouts/di/__tests__/workoutsTestData';
import { sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
import { useSessionPageLogic } from '@/features/workouts/ui/pages/SessionPage/SessionPage.logic';

beforeEach(() => {
  resetAllStores();
});

/** The live workout screen over the builder's open push day. */
const renderScreen = async (
  session = aSession(),
  permission: Parameters<typeof makeSessionScreenTestLayer>[0] = {},
) => {
  sessionLifecycle.restore(session);
  const test = makeSessionScreenTestLayer(permission);
  const rendered = await renderWithLayer(test.layer, useSessionPageLogic, undefined);
  return { ...rendered, screen: test.screen, permission: test.permission, scheduled: test.scheduled };
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

  it('arms the rest alert for the exercise whose set was ticked, not the current one', async () => {
    const { result, scheduled, done } = await renderScreen();

    await act(async () => result.current.effects.toggleSet(1, 0));

    await waitFor(() => expect(scheduled.size).toBe(1));
    expect(result.current.derived.blocks.map(block => block.isCurrent)).toEqual([true, false]);
    expect([...scheduled.values()][0]?.content.body).toBe(
      tr('push.restNext', {
        name: 'Overhead Press',
        next: tr('session.moreSetsOf', { count: 2, name: 'Overhead Press' }),
      }),
    );
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

  it('asks for the notification permission once when the workout opens', async () => {
    updateSettings({ notificationsGranted: false });
    const { result, permission, done } = await renderScreen(aSession(), { granted: false, canAsk: true });

    await waitFor(() => expect(getSettings().notificationsGranted).toBe(true));
    expect(permission.requests).toBe(1);
    expect(result.current.derived.restAlertsOff).toBeNull();
    await done();
  });

  it('asks nothing when the permission is already granted', async () => {
    const { result, permission, done } = await renderScreen();

    await act(async () => undefined);

    expect(permission.requests).toBe(0);
    expect(result.current.derived.restAlertsOff).toBeNull();
    await done();
  });

  it('says rest alerts are off after a refusal and opens the system settings', async () => {
    const { result, permission, done } = await renderScreen(aSession(), { granted: false, canAsk: false });

    await waitFor(() => expect(result.current.derived.restAlertsOff).not.toBeNull());
    expect(permission.requests).toBe(0);
    expect(result.current.derived.restAlertsOff).toEqual({
      meta: [{ id: 'alertsOff', icon: 'bellOff', label: tr('setRow.restAlertsOff') }],
      action: tr('setRow.restAlertsSettings'),
      hint: tr('setRow.restAlertsSettingsHint'),
    });
    await act(async () => result.current.effects.fixRestAlerts());

    await waitFor(() => expect(permission.settingsOpened).toBe(1));
    await done();
  });

  it("says rest alerts are off when the app's switch is off and opens the notifications screen", async () => {
    updateSettings({ notificationsEnabled: false });
    const { result, done } = await renderScreen();

    await waitFor(() => expect(result.current.derived.restAlertsOff?.action).toBe(tr('setRow.restAlertsTurnOn')));
    await act(async () => result.current.effects.fixRestAlerts());

    expect(routerFake.history.at(-1)).toEqual({ verb: 'push', href: routes.settingsNotifications() });
    await done();
  });
});
