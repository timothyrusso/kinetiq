import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { updateSettings } from '@/features/settings';
import { aSession } from '@/features/workouts/__fixtures__/builders';
import { makeRestAlertTestLayer } from '@/features/workouts/di/__tests__/workoutsTestData';
import { sessionLifecycle, useActiveSession } from '@/features/workouts/facades/useActiveSession';
import { useRestTimer } from '@/features/workouts/facades/useRestTimer';

const useTimer = () => {
  const { session } = useActiveSession();
  return { timer: useRestTimer(session), session };
};

const renderTimer = async (notificationsOn = true) => {
  updateSettings({ notificationsEnabled: notificationsOn, notificationsGranted: notificationsOn });
  const { layer, scheduled } = makeRestAlertTestLayer();
  return { ...(await renderWithLayer(layer, useTimer, undefined)), scheduled };
};

beforeEach(() => {
  resetAllStores();
  sessionLifecycle.restore(aSession());
});

describe('useRestTimer', () => {
  it('counts down from the stored deadline', async () => {
    sessionLifecycle.restore(aSession({ restEndsAt: Date.now() + 30_000, restDurationSeconds: 90 }));

    const { result, done } = await renderTimer();

    expect(result.current.timer.remaining).toBeGreaterThanOrEqual(29);
    expect(result.current.timer.remaining).toBeLessThanOrEqual(30);
    expect(result.current.timer.total).toBe(90);
    await done();
  });

  it('shows no rest when none is running', async () => {
    const { result, done } = await renderTimer();

    expect(result.current.timer.remaining).toBe(0);
    await done();
  });

  it('starts a rest and arms an alert naming what comes next', async () => {
    const { result, scheduled, done } = await renderTimer();

    await act(async () => result.current.timer.start(90));

    expect(result.current.session?.restDurationSeconds).toBe(90);
    await waitFor(() => expect(scheduled.size).toBe(1));
    expect([...scheduled.values()][0]).toEqual({
      content: {
        title: tr('push.restComplete'),
        body: tr('push.restNext', { name: 'Bench Press', next: 'Overhead Press' }),
      },
      trigger: { kind: 'afterSeconds', seconds: 90 },
    });
    await done();
  });

  it('starts a rest without an alert when notifications are off', async () => {
    const { result, scheduled, done } = await renderTimer(false);

    await act(async () => result.current.timer.start(90));

    expect(result.current.session?.restDurationSeconds).toBe(90);
    expect(scheduled.size).toBe(0);
    await done();
  });

  it('skips the rest and retracts its alert', async () => {
    const { result, scheduled, done } = await renderTimer();
    await act(async () => result.current.timer.start(90));
    await waitFor(() => expect(scheduled.size).toBe(1));

    await act(async () => result.current.timer.skip());

    expect(result.current.session?.restEndsAt).toBeNull();
    await waitFor(() => expect(scheduled.size).toBe(0));
    await done();
  });

  it('restarts the rest from an adjustment', async () => {
    const { result, scheduled, done } = await renderTimer();
    await act(async () => result.current.timer.start(90));
    await waitFor(() => expect(scheduled.size).toBe(1));

    await act(async () => result.current.timer.adjust(60));

    expect(result.current.session?.restDurationSeconds).toBe(60);
    await waitFor(() => expect(scheduled.size).toBe(0));
    await done();
  });

  it('clears the rest when an adjustment goes below five seconds', async () => {
    const { result, scheduled, done } = await renderTimer();
    await act(async () => result.current.timer.start(90));
    await waitFor(() => expect(scheduled.size).toBe(1));

    await act(async () => result.current.timer.adjust(3));

    expect(result.current.session?.restEndsAt).toBeNull();
    await waitFor(() => expect(scheduled.size).toBe(0));
    await done();
  });

  it('retracts the armed alert on an adjustment', async () => {
    const { result, scheduled, done } = await renderTimer();
    await act(async () => result.current.timer.start(90));
    await waitFor(() => expect(scheduled.size).toBe(1));

    await act(async () => result.current.timer.adjust(60));

    await waitFor(() => expect(scheduled.size).toBe(0));
    await done();
  });
});
