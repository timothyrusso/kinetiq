/**
 * Dates in the reader's language.
 *
 * `format.ts` builds its date formatters once, at import time, in `en-US`, and `formatAgo`
 * spells "5d ago" in English: so an Italian reader saw "5d ago" and "May 12" on screens whose
 * every other word was Italian. These helpers are the same shapes, resolved at CALL time: the
 * language comes from the settings store through `tr()` and `localeTag`, exactly as a service
 * composes a sentence, so a language change takes effect on the next render with no reload.
 *
 * Kept beside `format.ts` rather than inside it so the screens that still use the old helpers
 * do not change behaviour underneath their owners; they can move over one call at a time.
 */
import { localeTag } from '@/i18n';
import { tr } from '@/i18n/tr';
import { getSettings } from '@/settings/store';
import { daysBetween, toDate, type DateInput } from './format';

type Formatters = { shortDate: Intl.DateTimeFormat; fullDate: Intl.DateTimeFormat; time: Intl.DateTimeFormat };

/** One set per locale tag, built on first use: an `Intl` formatter is not free to construct. */
const cache = new Map<string, Formatters>();

function formatters(): Formatters {
  const tag = localeTag(getSettings().language);
  let found = cache.get(tag);
  if (!found) {
    found = {
      shortDate: new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric' }),
      fullDate: new Intl.DateTimeFormat(tag, { weekday: 'long', month: 'long', day: 'numeric' }),
      time: new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit' }),
    };
    cache.set(tag, found);
  }
  return found;
}

/** "12 May" · "12 mag". */
export function shortDateLabel(date: DateInput): string {
  return formatters().shortDate.format(toDate(date));
}

/** "Tuesday 12 May" · "martedì 12 maggio". */
export function fullDateLabel(date: DateInput): string {
  return formatters().fullDate.format(toDate(date));
}

/** "07:42" · "07:42", in the locale's own clock. */
export function timeOfDayLabel(date: DateInput): string {
  return formatters().time.format(toDate(date));
}

/** "5d ago" · "5 g fa": the localized `formatAgo`, same thresholds. */
export function agoLabel(date: DateInput, now: DateInput = new Date()): string {
  const seconds = Math.max(0, (toDate(now).getTime() - toDate(date).getTime()) / 1000);
  if (seconds < 3600) return tr('details.agoJustNow');
  const hours = seconds / 3600;
  if (hours < 24) return tr('details.agoHours', { n: Math.round(hours) });
  const days = daysBetween(date, now);
  if (days < 7) return tr('details.agoDays', { n: days });
  if (days < 31) return tr('details.agoWeeks', { n: Math.floor(days / 7) });
  return shortDateLabel(date);
}
