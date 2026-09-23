/**
 * Relative dates in the user's language.
 *
 * `formatAgo` and the day and week labels `useActivities` builds are English literals ("5d
 * ago", "Week of Mar 3"), which read as untranslated scraps on an Italian screen. These are the
 * same rules with the words taken from the catalog and the dates formatted in the app's own
 * locale rather than the device's, so a phone set to English running the app in Italian still
 * gets Italian month names.
 *
 * The translator is a parameter: a component passes the `t` and `locale` from `useT()`, so
 * a memoised caller re-renders on a language change; code outside React passes `tr` and the
 * locale it has. The `*Label` helpers at the end are the same rules with no parameters: they
 * read the language at call time, for callers that already re-render through `useT()`.
 */
import { localeTag, type TKey, type TVars } from '@/i18n';
import { tr } from '@/i18n/tr';
import { getSettings } from '@/settings/store';
import { toDate, type DateInput } from './format';

type Translate = (key: TKey, vars?: TVars) => string;

const DAY_MS = 86_400_000;

function midnight(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysBetween(from: number, to: number): number {
  return Math.round((midnight(to) - midnight(from)) / DAY_MS);
}

/** Formatters are built once per locale and shape: `Intl` construction is the expensive half. */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
function formatter(
  shape: 'short' | 'full' | 'time',
  locale: string,
): Intl.DateTimeFormat {
  const key = `${shape}|${locale}`;
  let fmt = FORMATTERS.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(
      locale,
      shape === 'short'
        ? { day: 'numeric', month: 'short' }
        : shape === 'full'
          ? { weekday: 'long', day: 'numeric', month: 'long' }
          : { hour: 'numeric', minute: '2-digit' },
    );
    FORMATTERS.set(key, fmt);
  }
  return fmt;
}
function shortDate(ms: number, locale: string): string {
  return formatter('short', locale).format(ms);
}

/** "3 days ago", "just now": the same thresholds as `formatAgo`, in the user's language. */
export function formatAgoLocalized(
  ms: number,
  t: Translate,
  locale: string,
  now: number = Date.now(),
): string {
  const seconds = Math.max(0, (now - ms) / 1000);
  if (seconds < 3600) return t('workoutFlow.justNow');
  const hours = seconds / 3600;
  if (hours < 24) return t('workoutFlow.hoursAgo', { count: Math.round(hours) });
  const days = daysBetween(ms, now);
  if (days < 7) return t('workoutFlow.daysAgo', { count: days });
  if (days < 31) return t('workoutFlow.weeksAgo', { count: Math.floor(days / 7) });
  return shortDate(ms, locale);
}

/** A record's date, or any other "on this day" label: "3 Mar" in the user's language. */
export function formatShortDateLocalized(ms: number, locale: string): string {
  return shortDate(ms, locale);
}

/**
 * The heading for a Monday-start week, given that Monday's local midnight: "This week",
 * "Last week", or "Week of 3 Mar".
 */
export function weekHeading(
  weekStartMs: number,
  t: Translate,
  locale: string,
  now: number = Date.now(),
): string {
  const today = new Date(midnight(now));
  const monday = today.getTime() - ((today.getDay() + 6) % 7) * DAY_MS;
  const weeksBack = Math.round((midnight(monday) - midnight(weekStartMs)) / (7 * DAY_MS));
  if (weeksBack === 0) return t('workoutFlow.thisWeek');
  if (weeksBack === 1) return t('workoutFlow.lastWeek');
  return t('workoutFlow.weekOf', { date: shortDate(weekStartMs, locale) });
}

function currentLocale(): string {
  return localeTag(getSettings().language);
}

/** "5d ago" · "5 g fa": `formatAgoLocalized` in the current language. */
export function agoLabel(date: DateInput, now: DateInput = new Date()): string {
  return formatAgoLocalized(toDate(date).getTime(), tr, currentLocale(), toDate(now).getTime());
}

/** "12 May" · "12 mag". */
export function shortDateLabel(date: DateInput): string {
  return shortDate(toDate(date).getTime(), currentLocale());
}

/** "Tuesday 12 May" · "martedì 12 maggio". */
export function fullDateLabel(date: DateInput): string {
  return formatter('full', currentLocale()).format(toDate(date));
}

/** "07:42", in the locale's own clock. */
export function timeOfDayLabel(date: DateInput): string {
  return formatter('time', currentLocale()).format(toDate(date));
}

/** "07:30" · "7:30 AM": a time of day given as minutes from midnight, in the app's language. */
export function formatClock(minutesFromMidnight: number): string {
  const total = ((Math.round(minutesFromMidnight) % 1440) + 1440) % 1440;
  return timeOfDayLabel(new Date(2024, 0, 1, Math.floor(total / 60), total % 60));
}
