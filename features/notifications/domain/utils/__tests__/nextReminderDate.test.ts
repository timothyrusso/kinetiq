import { nextReminderDate } from '@/features/notifications/domain/utils/nextReminderDate';

/** Wednesday 2026-09-23, 12:00 local time. */
const wednesdayNoon = new Date(2026, 8, 23, 12, 0, 0, 0);

describe('nextReminderDate', () => {
  it('picks today when the time is still ahead', () => {
    const next = nextReminderDate({ enabled: true, minuteOfDay: 18 * 60 + 30, days: [3] }, wednesdayNoon);
    expect(next).toEqual(new Date(2026, 8, 23, 18, 30, 0, 0));
  });

  it('skips to the next picked day once the time has passed', () => {
    const next = nextReminderDate({ enabled: true, minuteOfDay: 8 * 60, days: [1, 3, 5] }, wednesdayNoon);
    expect(next).toEqual(new Date(2026, 8, 25, 8, 0, 0, 0));
  });

  it('wraps to the same weekday next week when it is the only day and already past', () => {
    const next = nextReminderDate({ enabled: true, minuteOfDay: 8 * 60, days: [3] }, wednesdayNoon);
    expect(next).toEqual(new Date(2026, 8, 30, 8, 0, 0, 0));
  });

  it('reads Sunday as ISO day 7', () => {
    const next = nextReminderDate({ enabled: true, minuteOfDay: 9 * 60, days: [7] }, wednesdayNoon);
    expect(next?.getDay()).toBe(0);
  });

  it('is null when the reminder is off or has no day', () => {
    expect(nextReminderDate({ enabled: false, minuteOfDay: 600, days: [3] }, wednesdayNoon)).toBeNull();
    expect(nextReminderDate({ enabled: true, minuteOfDay: 600, days: [] }, wednesdayNoon)).toBeNull();
  });
});
