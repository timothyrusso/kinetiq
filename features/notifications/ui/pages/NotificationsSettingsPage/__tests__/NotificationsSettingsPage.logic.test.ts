import { act, waitFor } from '@testing-library/react-native';
import type { SettingsRow, SettingsSection } from '@/features/core/design-system';
import { resetAllStores, setSessionInProgress } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { makeSchedulerFake } from '@/features/notifications/di/__tests__/schedulerFake';
import { useNotificationsSettingsPageLogic } from '@/features/notifications/ui/pages/NotificationsSettingsPage/NotificationsSettingsPage.logic';
import { getSettings, updateSettings } from '@/features/settings';

const { layer: SchedulerFake, device, reset } = makeSchedulerFake();

beforeEach(() => {
  resetAllStores();
  reset();
  device.permission = false;
  updateSettings({ notificationsEnabled: true, reminder: { enabled: true, minuteOfDay: 18 * 60, days: [1, 3, 5] } });
});

const renderPage = async () => {
  const rendered = await renderWithLayer(SchedulerFake, useNotificationsSettingsPageLogic, undefined);
  await waitFor(() => expect(getSettings().notificationsGranted).toBe(device.permission));
  return {
    ...rendered,
    done: async () => {
      await rendered.unmount();
      await rendered.done();
    },
  };
};

const sectionOf = (sections: readonly SettingsSection[], key: string) => sections.find(section => section.key === key);
const rowOf = (sections: readonly SettingsSection[], section: string, key: string) =>
  sectionOf(sections, section)?.rows.find(row => row.key === key);
const press = (row: SettingsRow | undefined) => {
  if (row?.kind === 'button' || row?.kind === 'check') row.onPress();
};
const flip = (row: SettingsRow | undefined, next: boolean) => {
  if (row?.kind === 'switch') row.onChange(next);
};
const reminders = () => [...device.pending.values()].filter(request => request.trigger?.kind === 'at');

describe('useNotificationsSettingsPageLogic without permission', () => {
  it('offers to ask for the permission', async () => {
    const { result, done } = await renderPage();

    expect(rowOf(result.current.derived.sections, 'system', 'ask')?.title).toBe(tr('notif.askForPermission'));
    await done();
  });

  it('draws the master switch off and disabled, whatever the stored wish', async () => {
    const { result, done } = await renderPage();

    expect(rowOf(result.current.derived.sections, 'master', 'send')).toMatchObject({ value: false, disabled: true });
    await done();
  });

  it('offers no test alert', async () => {
    const { result, done } = await renderPage();

    expect(sectionOf(result.current.derived.sections, 'rest')?.rows).toEqual([]);
    await done();
  });

  it('schedules the reminder once the user allows notifications', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'system', 'ask')));

    await waitFor(() => {
      expect(reminders()).toHaveLength(1);
      expect(rowOf(result.current.derived.sections, 'system', 'ask')).toBeUndefined();
    });
    await done();
  });

  it('keeps offering to ask and schedules nothing when the user refuses', async () => {
    device.answer = false;
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'system', 'ask')));

    await waitFor(() =>
      expect(rowOf(result.current.derived.sections, 'system', 'ask')?.title).toBe(tr('notif.askForPermission')),
    );
    expect(device.pending.size).toBe(0);
    await done();
  });
});

describe('useNotificationsSettingsPageLogic with permission', () => {
  beforeEach(() => {
    device.permission = true;
  });

  it('shows the schedule and the day checklist', async () => {
    const { result, done } = await renderPage();

    await waitFor(() => expect(rowOf(result.current.derived.sections, 'reminder', 'time')).toBeDefined());
    expect(sectionOf(result.current.derived.sections, 'reminder')?.rows).toHaveLength(9);
    await done();
  });

  it('retracts everything scheduled when the master switch goes off', async () => {
    const { result, done } = await renderPage();
    await act(async () => press(rowOf(result.current.derived.sections, 'rest', 'test')));
    await waitFor(() => expect(device.pending.size).toBe(1));

    await act(async () => flip(rowOf(result.current.derived.sections, 'master', 'send'), false));

    await waitFor(() => expect(device.pending.size).toBe(0));
    expect(getSettings().notificationsEnabled).toBe(false);
    await done();
  });

  it('schedules the reminder when the master switch comes back on', async () => {
    updateSettings({ notificationsEnabled: false });
    const { result, done } = await renderPage();

    await act(async () => flip(rowOf(result.current.derived.sections, 'master', 'send'), true));

    await waitFor(() => expect(reminders()).toHaveLength(1));
    await done();
  });

  it('posts an immediate test alert', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'rest', 'test')));

    await waitFor(() => expect([...device.pending.values()].map(request => request.trigger)).toEqual([null]));
    await done();
  });

  it('stores a picked day in order and schedules again', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'reminder', 'day-2')));

    expect(getSettings().reminder.days).toEqual([1, 2, 3, 5]);
    await waitFor(() => expect(reminders()).toHaveLength(1));
    await done();
  });

  it('stores an unpicked day without it', async () => {
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'reminder', 'day-3')));

    expect(getSettings().reminder.days).toEqual([1, 5]);
    await done();
  });

  it('turns the reminder off and leaves it unscheduled', async () => {
    const { result, done } = await renderPage();

    await act(async () => flip(rowOf(result.current.derived.sections, 'reminder', 'remind'), false));

    await waitFor(() => expect(rowOf(result.current.derived.sections, 'reminder', 'time')).toBeUndefined());
    expect(getSettings().reminder.enabled).toBe(false);
    expect(reminders()).toEqual([]);
    await done();
  });

  it('leaves the schedule alone mid-workout and says the change is waiting', async () => {
    setSessionInProgress(true);
    const { result, done } = await renderPage();

    await act(async () => press(rowOf(result.current.derived.sections, 'reminder', 'day-2')));

    expect(sectionOf(result.current.derived.sections, 'reminder')?.footer).toBe(tr('misc.midSessionNote'));
    expect(getSettings().reminder.days).toEqual([1, 2, 3, 5]);
    expect(device.pending.size).toBe(0);
    await done();
  });
});
