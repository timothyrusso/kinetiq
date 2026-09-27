import { currentLocaleTag, tr } from '@/features/core/translations';
import {
  agoLabel,
  formatAgoLocalized,
  formatClock,
  formatShortDateLocalized,
  fullDateLabel,
  shortDateLabel,
  timeOfDayLabel,
  weekHeading,
} from '@/features/core/utils';

const NOW = new Date(2026, 8, 23, 12, 0).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('formatAgoLocalized', () => {
  it('says just now within the hour', () => {
    expect(formatAgoLocalized(NOW - 10 * 60_000, tr, 'en-GB', NOW)).toBe(tr('workoutFlow.justNow'));
  });

  it('counts hours within the day', () => {
    expect(formatAgoLocalized(NOW - 5 * HOUR, tr, 'en-GB', NOW)).toBe(tr('workoutFlow.hoursAgo', { count: 5 }));
  });

  it('counts days within the week', () => {
    expect(formatAgoLocalized(NOW - 3 * DAY, tr, 'en-GB', NOW)).toBe(tr('workoutFlow.daysAgo', { count: 3 }));
  });

  it('counts weeks within the month', () => {
    expect(formatAgoLocalized(NOW - 15 * DAY, tr, 'en-GB', NOW)).toBe(tr('workoutFlow.weeksAgo', { count: 2 }));
  });

  it('shows the date past a month', () => {
    expect(formatAgoLocalized(new Date(2026, 5, 3).getTime(), tr, 'en-GB', NOW)).toBe('3 Jun');
  });

  it('reads a date in the future as just now', () => {
    expect(formatAgoLocalized(NOW + DAY, tr, 'en-GB', NOW)).toBe(tr('workoutFlow.justNow'));
  });
});

describe('weekHeading', () => {
  const MONDAY = new Date(2026, 8, 21).getTime();

  it('calls the current week this week', () => {
    expect(weekHeading(MONDAY, tr, 'en-GB', NOW)).toBe(tr('workoutFlow.thisWeek'));
  });

  it('calls the week before last week', () => {
    expect(weekHeading(MONDAY - 7 * DAY, tr, 'en-GB', NOW)).toBe(tr('workoutFlow.lastWeek'));
  });

  it('dates an older week by its Monday', () => {
    expect(weekHeading(new Date(2026, 8, 7).getTime(), tr, 'en-GB', NOW)).toBe(
      tr('workoutFlow.weekOf', { date: '7 Sept' }),
    );
  });
});

describe('the labels in the current language', () => {
  it('formats a short date as day and month', () => {
    expect(shortDateLabel(new Date(2026, 4, 12))).toBe(
      formatShortDateLocalized(new Date(2026, 4, 12).getTime(), currentLocaleTag()),
    );
  });

  it('formats ago against the given now', () => {
    expect(agoLabel(NOW - 3 * DAY, NOW)).toBe(tr('workoutFlow.daysAgo', { count: 3 }));
  });

  it('names the weekday in a full date', () => {
    expect(fullDateLabel(new Date(2026, 4, 12))).toContain('Tuesday');
  });

  it('formats minutes from midnight as the time of day', () => {
    expect(formatClock(7 * 60 + 30)).toBe(timeOfDayLabel(new Date(2024, 0, 1, 7, 30)));
  });

  it('wraps minutes past midnight into the day', () => {
    expect(formatClock(1440 + 15)).toBe(formatClock(15));
  });
});
