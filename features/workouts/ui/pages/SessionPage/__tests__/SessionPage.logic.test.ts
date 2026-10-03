import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { spacing } from '@/features/core/theme';
import { tr } from '@/features/core/translations';
import { getSettings, updateSettings } from '@/features/settings';
import { anEntry, anotherEntry, aSession } from '@/features/workouts/__fixtures__/builders';
import { makeSessionScreenTestLayer } from '@/features/workouts/di/__tests__/workoutsTestData';
import { sessionActions, sessionLifecycle } from '@/features/workouts/facades/useActiveSession';
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

  it('opens the exercise’s sheet on the tapped set and makes the exercise current', async () => {
    const { result, done } = await renderScreen();

    await act(async () => result.current.effects.openSet(1, 0));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.sessionExercise(1, 0) }]);
    expect(result.current.derived.blocks.map(block => block.isCurrent)).toEqual([false, true]);
    await done();
  });

  it('opens the exercise’s sheet with no set from its name', async () => {
    const { result, done } = await renderScreen();

    await act(async () => result.current.effects.openExercise(1));

    expect(routerFake.history).toEqual([{ verb: 'push', href: routes.sessionExercise(1) }]);
    expect(result.current.derived.blocks.map(block => block.isCurrent)).toEqual([false, true]);
    await done();
  });

  it('starts the rest on a tick with the exercise’s rest as edited since the workout began', async () => {
    const { result, done } = await renderScreen();

    await act(async () => sessionActions.updateEntry(1, { restSeconds: 45 }));
    await act(async () => result.current.effects.toggleSet(1, 0));

    expect(result.current.derived.restShown).toBe(true);
    expect(result.current.state.restTotal).toBe(45);
    await done();
  });

  it('starts no rest for an exercise whose rest is zero', async () => {
    const { result, done } = await renderScreen();

    await act(async () => sessionActions.updateEntry(1, { restSeconds: 0 }));
    await act(async () => result.current.effects.toggleSet(1, 0));

    expect(result.current.state.session?.entries[1]?.sets[0]?.completed).toBe(true);
    expect(result.current.derived.restShown).toBe(false);
    await done();
  });

  it('arms the rest alert for the exercise whose set was ticked, not the current one', async () => {
    const { result, scheduled, done } = await renderScreen();

    await act(async () => result.current.effects.toggleSet(1, 0));

    await waitFor(() => expect(scheduled.size).toBe(1));
    expect(result.current.derived.blocks.map(block => block.isCurrent)).toEqual([true, false]);
    expect([...scheduled.values()][0]?.content.body).toBe(
      tr('push.restNextSet', { name: 'Overhead Press', set: 2, total: 3 }),
    );
    await done();
  });

  it('removes the only exercise after the confirmation, back to the empty workout', async () => {
    const { result, done } = await renderScreen(aSession({ entries: [anEntry()] }));

    await act(async () => result.current.effects.requestRemove(0));
    expect(result.current.derived.removingName).toBe('Bench Press');
    await act(async () => result.current.effects.confirmRemove());

    expect(result.current.state.removing).toBeNull();
    expect(result.current.state.session?.entries).toEqual([]);
    expect(result.current.derived.blocks).toEqual([]);
    expect(result.current.derived.exercisesEyebrow).toBe(`0 ${tr('session.exerciseWord', { count: 0 })}`);
    expect(result.current.derived.progress).toMatchObject({ completed: 0, planned: 0, ratio: 0 });
    await done();
  });

  it('ends the rest and pulls back its alert when the last exercise goes', async () => {
    const { result, scheduled, done } = await renderScreen(aSession({ entries: [anotherEntry()] }));
    await act(async () => result.current.effects.toggleSet(0, 0));
    await waitFor(() => expect(scheduled.size).toBe(1));

    await act(async () => result.current.effects.requestRemove(0));
    await act(async () => result.current.effects.confirmRemove());

    expect(result.current.derived.restShown).toBe(false);
    await waitFor(() => expect(scheduled.size).toBe(0));
    await done();
  });

  it('adds to a workout emptied mid-way as to an empty one, the new exercise current', async () => {
    const { result, done } = await renderScreen(aSession({ entries: [anEntry()] }));
    await act(async () => result.current.effects.requestRemove(0));
    await act(async () => result.current.effects.confirmRemove());

    await act(async () => sessionActions.addExercise(anotherEntry()));

    expect(result.current.derived.blocks.map(block => block.isCurrent)).toEqual([true]);
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
