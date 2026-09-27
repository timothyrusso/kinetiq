import { describeDays, reminderHint } from '@/features/notifications/mappers/describeReminder';

describe('describeDays', () => {
  it('names a run of three or more days as a range, and anything else as a list', () => {
    expect(describeDays([1, 2, 3, 4, 5], 'en-GB')).toBe('Mon-Fri');
    expect(describeDays([1, 3, 5], 'en-GB')).toBe('Mon, Wed, Fri');
    expect(describeDays([6, 7], 'en-GB')).toBe('Sat, Sun');
    expect(describeDays([2], 'en-GB')).toBe('Tue');
  });

  it('says every day for all seven', () => {
    expect(describeDays([1, 2, 3, 4, 5, 6, 7], 'en-GB')).toBe('Every day');
  });
});

describe('reminderHint', () => {
  const reminder = { enabled: true, minuteOfDay: 18 * 60, days: [1, 3, 5] };

  it('describes the outcome the user is in, most blocking cause first', () => {
    const off = reminderHint(reminder, false, true, 'en-GB');
    const blocked = reminderHint(reminder, true, false, 'en-GB');
    const idle = reminderHint({ ...reminder, enabled: false }, true, true, 'en-GB');
    const noDays = reminderHint({ ...reminder, days: [] }, true, true, 'en-GB');
    expect(new Set([off, blocked, idle, noDays]).size).toBe(4);
    expect(reminderHint(reminder, true, true, 'en-GB')).toContain('Mon, Wed, Fri');
    expect(reminderHint(reminder, true, true, 'en-GB')).toContain('18:00');
  });
});
