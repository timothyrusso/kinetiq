import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { makeSchedulerFake } from '@/features/notifications/di/__tests__/schedulerFake';
import {
  useAskNotificationPermissionOnce,
  useNotificationPermission,
} from '@/features/notifications/facades/useNotificationPermission';
import { useRestAlert } from '@/features/notifications/facades/useRestAlert';
import { useRestAlertsOff } from '@/features/notifications/facades/useRestAlertsOff';
import { getSettings, updateSettings } from '@/features/settings';

const { layer: SchedulerFake, device, reset } = makeSchedulerFake();

beforeEach(() => {
  resetAllStores();
  reset();
});

const render = async <Result>(hook: () => Result) => {
  const rendered = await renderWithLayer(SchedulerFake, hook, undefined);
  return {
    ...rendered,
    done: async () => {
      await rendered.unmount();
      await rendered.done();
    },
  };
};

describe('useNotificationPermission', () => {
  it('reports the permission the device grants and mirrors it into the settings', async () => {
    const { result, done } = await render(useNotificationPermission);

    await waitFor(() => expect(result.current.granted).toBe(true));
    expect(getSettings().notificationsGranted).toBe(true);
    await done();
  });

  it('reads a device that cannot say as not granted', async () => {
    device.permission = 'unreadable';
    const { result, done } = await render(useNotificationPermission);

    await waitFor(() => expect(getSettings().notificationsGranted).toBe(false));
    expect(result.current.granted).toBe(false);
    await done();
  });

  it('takes the answer to a request as the new permission', async () => {
    device.permission = false;
    const { result, done } = await render(useNotificationPermission);
    await waitFor(() => expect(getSettings().notificationsGranted).toBe(false));

    await act(async () => result.current.request());

    await waitFor(() => expect(result.current.granted).toBe(true));
    expect(getSettings().notificationsGranted).toBe(true);
    await done();
  });
});

describe('useAskNotificationPermissionOnce', () => {
  const renderAsk = async (when: boolean) => {
    const rendered = await renderWithLayer(SchedulerFake, useAskNotificationPermissionOnce, when);
    return {
      ...rendered,
      done: async () => {
        await rendered.unmount();
        await rendered.done();
      },
    };
  };

  it('asks once while the system can still show its prompt, and mirrors the grant', async () => {
    device.permission = false;
    device.canAsk = true;
    updateSettings({ notificationsGranted: false });
    const { rerender, done } = await renderAsk(true);

    await waitFor(() => expect(getSettings().notificationsGranted).toBe(true));
    await rerender(false);
    await rerender(true);
    await act(async () => undefined);

    expect(device.requests).toBe(1);
    await done();
  });

  it('waits for the start before it asks', async () => {
    device.permission = false;
    device.canAsk = true;
    const { done } = await renderAsk(false);

    await act(async () => undefined);

    expect(device.requests).toBe(0);
    await done();
  });

  it('asks nothing when the permission is already granted', async () => {
    const { done } = await renderAsk(true);

    await waitFor(() => expect(getSettings().notificationsGranted).toBe(true));
    expect(device.requests).toBe(0);
    await done();
  });

  it('asks nothing when the system has refused for good', async () => {
    device.permission = false;
    const { done } = await renderAsk(true);

    await waitFor(() => expect(getSettings().notificationsGranted).toBe(false));
    expect(device.requests).toBe(0);
    await done();
  });

  it("asks nothing while the app's own switch is off", async () => {
    device.permission = false;
    device.canAsk = true;
    updateSettings({ notificationsEnabled: false });
    const { done } = await renderAsk(true);

    await act(async () => undefined);

    expect(device.requests).toBe(0);
    await done();
  });
});

describe('useRestAlertsOff', () => {
  it('says nothing when alerts can be delivered', async () => {
    const { result, done } = await render(useRestAlertsOff);

    await act(async () => undefined);

    expect(result.current.reason).toBeNull();
    await done();
  });

  it('says nothing while the system can still ask', async () => {
    device.permission = false;
    device.canAsk = true;
    const { result, done } = await render(useRestAlertsOff);

    await act(async () => undefined);

    expect(result.current.reason).toBeNull();
    await done();
  });

  it('points a refusal at the system settings', async () => {
    device.permission = false;
    const { result, done } = await render(useRestAlertsOff);

    await waitFor(() => expect(result.current.reason).toBe('permission'));
    await act(async () => result.current.openSystemSettings());

    await waitFor(() => expect(device.settingsOpened).toBe(1));
    await done();
  });

  it("points the app's own switch at the notifications screen", async () => {
    updateSettings({ notificationsEnabled: false });
    const { result, done } = await render(useRestAlertsOff);

    await waitFor(() => expect(result.current.reason).toBe('switch'));
    await done();
  });

  it('puts a refusal before the switch, which cannot be turned on without it', async () => {
    device.permission = false;
    updateSettings({ notificationsEnabled: false });
    const { result, done } = await render(useRestAlertsOff);

    await waitFor(() => expect(result.current.reason).toBe('permission'));
    await done();
  });
});

describe('useRestAlert', () => {
  const alert = { exerciseName: 'Bench Press', nextLabel: 'Set 2', delaySeconds: 89.6 };

  it('arms the alert for the rest remaining and resolves its identifier', async () => {
    const { result, done } = await render(useRestAlert);

    let identifier: string | null = null;
    await act(async () => {
      identifier = await result.current.arm(alert);
    });

    expect(identifier).toBe('n1');
    expect(device.pending.get('n1')).toEqual({
      content: { title: tr('push.restComplete'), body: tr('push.restNext', { name: 'Bench Press', next: 'Set 2' }) },
      trigger: { kind: 'afterSeconds', seconds: 90 },
    });
    await done();
  });

  it('says the last set is done when nothing follows', async () => {
    const { result, done } = await render(useRestAlert);

    await act(async () => void (await result.current.arm({ ...alert, nextLabel: '' })));

    expect(device.pending.get('n1')?.content.body).toBe(tr('push.restLast', { name: 'Bench Press' }));
    await done();
  });

  it('resolves null and schedules nothing without permission', async () => {
    device.permission = false;
    const { result, done } = await render(useRestAlert);

    let identifier: string | null = 'unset';
    await act(async () => {
      identifier = await result.current.arm(alert);
    });

    expect(identifier).toBeNull();
    expect(device.pending.size).toBe(0);
    await done();
  });

  it('resolves null when the scheduler refuses the alert', async () => {
    device.refuseSchedule = true;
    const { result, done } = await render(useRestAlert);

    let identifier: string | null = 'unset';
    await act(async () => {
      identifier = await result.current.arm(alert);
    });

    expect(identifier).toBeNull();
    expect(device.pending.size).toBe(0);
    await done();
  });

  it('retracts exactly the alert it armed', async () => {
    const { result, done } = await render(useRestAlert);
    await act(async () => void (await result.current.arm(alert)));
    await act(async () => void (await result.current.arm({ ...alert, nextLabel: '' })));

    await act(async () => result.current.cancel('n1'));

    await waitFor(() => expect([...device.pending.keys()]).toEqual(['n2']));
    await done();
  });
});
