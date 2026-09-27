import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { makeSchedulerFake } from '@/features/notifications/di/__tests__/schedulerFake';
import { useNotificationPermission } from '@/features/notifications/facades/useNotificationPermission';
import { useRestAlert } from '@/features/notifications/facades/useRestAlert';
import { getSettings } from '@/features/settings';

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
