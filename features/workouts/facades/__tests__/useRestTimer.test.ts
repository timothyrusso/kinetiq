import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { updateSettings } from '@/features/settings';
import { anEntry, anOpenSet, anotherEntry, aSession } from '@/features/workouts/__fixtures__/builders';
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

const NOW = Date.UTC(2026, 0, 5, 18, 0, 0);

afterEach(() => jest.useRealTimers());

beforeEach(() => {
  resetAllStores();
  sessionLifecycle.restore(aSession());
});

describe('useRestTimer', () => {
  it('counts down from the stored deadline', async () => {
    jest.useFakeTimers({ now: NOW });
    sessionLifecycle.restore(aSession({ restEndsAt: NOW + 30_000, restDurationSeconds: 90 }));

    const { result, done } = await renderTimer();

    expect(result.current.timer.remaining).toBe(30);
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

    await act(async () => result.current.timer.start(90, 0));

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

  describe('for a set ticked outside the current exercise', () => {
    const squat = anEntry({
      exerciseId: 'wger:111',
      exerciseName: 'Squat',
      sets: [anOpenSet(), anOpenSet({ index: 1 })],
    });
    const bodyOf = (scheduled: ReadonlyMap<string, { content: { body: string } }>) =>
      [...scheduled.values()][0]?.content.body;

    it('names the next open set of the ticked exercise without calling it done', async () => {
      sessionLifecycle.restore(aSession({ entries: [anEntry(), anotherEntry(), squat] }));
      const { result, scheduled, done } = await renderTimer();

      await act(async () => result.current.timer.start(60, 1));

      await waitFor(() => expect(scheduled.size).toBe(1));
      expect(bodyOf(scheduled)).toBe(tr('push.restNextSet', { name: 'Overhead Press', set: 1, total: 3 }));
      await done();
    });

    it('keeps naming the ticked exercise after an adjustment', async () => {
      sessionLifecycle.restore(aSession({ entries: [anEntry(), anotherEntry(), squat] }));
      const { result, scheduled, done } = await renderTimer();
      await act(async () => result.current.timer.start(60, 2));
      await waitFor(() => expect(scheduled.size).toBe(1));
      const [first] = [...scheduled.keys()];

      await act(async () => result.current.timer.adjust(75));

      await waitFor(() => expect([...scheduled.keys()]).not.toContain(first));
      expect(scheduled.size).toBe(1);
      expect(bodyOf(scheduled)).toBe(tr('push.restNextSet', { name: 'Squat', set: 1, total: 2 }));
      await done();
    });

    it('points back up the list when the ticked exercise is done and only earlier ones are open', async () => {
      const bench = anEntry({ sets: [anOpenSet()] });
      sessionLifecycle.restore(
        aSession({ entries: [bench, anEntry({ exerciseId: 'wger:74', exerciseName: 'Overhead Press' })] }),
      );
      const { result, scheduled, done } = await renderTimer();

      await act(async () => result.current.timer.start(60, 1));

      await waitFor(() => expect(scheduled.size).toBe(1));
      expect(bodyOf(scheduled)).toBe(tr('push.restNext', { name: 'Overhead Press', next: 'Bench Press' }));
      await done();
    });

    it('says the workout is done when nothing is left open', async () => {
      sessionLifecycle.restore(
        aSession({ entries: [anEntry(), anEntry({ exerciseId: 'wger:74', exerciseName: 'Overhead Press' })] }),
      );
      const { result, scheduled, done } = await renderTimer();

      await act(async () => result.current.timer.start(60, 1));

      await waitFor(() => expect(scheduled.size).toBe(1));
      expect(bodyOf(scheduled)).toBe(tr('push.restLast', { name: 'Overhead Press' }));
      await done();
    });

    it('names the ticked exercise when alerts turn on mid-rest', async () => {
      sessionLifecycle.restore(aSession({ entries: [anEntry(), anotherEntry(), squat] }));
      const { result, scheduled, done } = await renderTimer(false);
      await act(async () => result.current.timer.start(60, 2));
      expect(scheduled.size).toBe(0);

      await act(async () => updateSettings({ notificationsGranted: true, notificationsEnabled: true }));

      await waitFor(() => expect(scheduled.size).toBe(1));
      expect(bodyOf(scheduled)).toBe(tr('push.restNextSet', { name: 'Squat', set: 1, total: 2 }));
      await done();
    });
  });

  it('starts a rest without an alert when notifications are off', async () => {
    const { result, scheduled, done } = await renderTimer(false);

    await act(async () => result.current.timer.start(90, 0));

    expect(result.current.session?.restDurationSeconds).toBe(90);
    expect(scheduled.size).toBe(0);
    await done();
  });

  it('skips the rest and retracts its alert', async () => {
    const { result, scheduled, done } = await renderTimer();
    await act(async () => result.current.timer.start(90, 0));
    await waitFor(() => expect(scheduled.size).toBe(1));

    await act(async () => result.current.timer.skip());

    expect(result.current.session?.restEndsAt).toBeNull();
    await waitFor(() => expect(scheduled.size).toBe(0));
    await done();
  });

  it('restarts the rest from an adjustment and arms the alert for the new deadline', async () => {
    const { result, scheduled, done } = await renderTimer();
    await act(async () => result.current.timer.start(90, 0));
    await waitFor(() => expect(scheduled.size).toBe(1));
    const [first] = [...scheduled.keys()];

    await act(async () => result.current.timer.adjust(60));

    expect(result.current.session?.restDurationSeconds).toBe(60);
    expect(result.current.session?.restEndsAt).toBeGreaterThan(Date.now() + 59_000);
    await waitFor(() => expect([...scheduled.keys()]).not.toContain(first));
    expect(scheduled.size).toBe(1);
    expect([...scheduled.values()][0]?.trigger).toEqual({ kind: 'afterSeconds', seconds: 60 });
    await done();
  });

  it('starts no alert for an adjustment when notifications are off', async () => {
    const { result, scheduled, done } = await renderTimer(false);
    await act(async () => result.current.timer.start(90, 0));

    await act(async () => result.current.timer.adjust(60));

    expect(result.current.session?.restDurationSeconds).toBe(60);
    expect(scheduled.size).toBe(0);
    await done();
  });

  it('clears the rest when an adjustment goes below five seconds', async () => {
    const { result, scheduled, done } = await renderTimer();
    await act(async () => result.current.timer.start(90, 0));
    await waitFor(() => expect(scheduled.size).toBe(1));

    await act(async () => result.current.timer.adjust(3));

    expect(result.current.session?.restEndsAt).toBeNull();
    await waitFor(() => expect(scheduled.size).toBe(0));
    await done();
  });

  it('arms the rest already running when alerts turn on mid-rest, for the time it has left', async () => {
    jest.useFakeTimers({ now: NOW });
    sessionLifecycle.restore(aSession({ restEndsAt: NOW + 40_000, restDurationSeconds: 90 }));
    const { scheduled, done } = await renderTimer(false);
    expect(scheduled.size).toBe(0);

    await act(async () => updateSettings({ notificationsGranted: true, notificationsEnabled: true }));

    await waitFor(() => expect(scheduled.size).toBe(1));
    expect([...scheduled.values()][0]?.trigger).toEqual({ kind: 'afterSeconds', seconds: 40 });
    await done();
  });

  it('arms nothing when alerts turn on with no rest running', async () => {
    const { scheduled, done } = await renderTimer(false);

    await act(async () => updateSettings({ notificationsGranted: true, notificationsEnabled: true }));

    expect(scheduled.size).toBe(0);
    await done();
  });
});
