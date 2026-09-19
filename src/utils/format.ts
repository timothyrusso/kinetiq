/**
 * Formatting primitives. All domain values are stored canonically in metric
 * (metres, kilograms, seconds-per-kilometre); conversion happens only here, at
 * the moment a value is shown.
 */

export type UnitSystem = 'metric' | 'imperial';

const KM = 1000;
const MILE_IN_METERS = 1609.344;
const LB_PER_KG = 2.2046226218;

/* ---------------------------------------------------------------- numbers -- */

/** Trims trailing zeros: 5.00 -> "5", 5.40 -> "5.4", 5.42 -> "5.42" */
export function trimNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function fixed(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** 1234 -> "1,234" · 1234567 -> "1.23M" */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimNumber(value / 1_000_000, 1)}M`;
  if (abs >= 10_000) return `${trimNumber(value / 1000, 1)}k`;
  return Math.round(value).toLocaleString('en-US');
}

/** Signed for deltas: 12 -> "+12", -3 -> "−3" (typographic minus). */
export function signed(value: number, formatter: (n: number) => string = (n) => `${Math.round(n)}`): string {
  if (Math.abs(value) < 0.05) return '0';
  return value > 0 ? `+${formatter(value)}` : `−${formatter(Math.abs(value))}`;
}

/* --------------------------------------------------------------- duration -- */

/** 3661 -> "1:01:01" · 2920 -> "48:40" */
export function formatDuration(totalSeconds: number, separator: ':' | "'" = ':'): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return separator === "'" ? `${h}:${pad(m)}'` : `${h}:${pad(m)}:${pad(sec)}`;
  return separator === "'" ? `${m}'${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 3661 -> "1h 01m" · 2920 -> "48m" — for compact chips. */
export function formatDurationCompact(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${Math.round(s % 60)}s`;
}

/** Ticking clock for the rest timer: 95 -> "1:35" */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ----------------------------------------------------------------- effort -- */

export function distanceValue(meters: number, system: UnitSystem): number {
  return system === 'metric' ? meters / KM : meters / MILE_IN_METERS;
}

export function distanceUnit(system: UnitSystem): string {
  return system === 'metric' ? 'km' : 'mi';
}

/** 5421 m -> "5.42 km" / "3.37 mi" */
export function formatDistance(meters: number, system: UnitSystem, digits = 2): string {
  const perUnit = system === 'metric' ? KM : MILE_IN_METERS;
  if (meters < perUnit * 0.1) {
    // Short efforts read better in metres/feet than as "0.03 km".
    if (system === 'metric') return `${Math.round(meters)} m`;
    return `${Math.round(meters * 3.280839895)} ft`;
  }
  return `${(meters / perUnit).toFixed(digits)}`;
}

export function formatDistanceWithUnit(meters: number, system: UnitSystem, digits = 2): string {
  return `${formatDistance(meters, system, digits)} ${distanceUnit(system)}`;
}

/** Canonical pace is seconds per kilometre. */
export function paceValue(secondsPerKm: number, system: UnitSystem): number {
  return system === 'metric' ? secondsPerKm : secondsPerKm * (MILE_IN_METERS / KM);
}

/** 312 s/km -> "5:12 /km" · imperial converts to s/mi. */
export function formatPace(secondsPerKm: number, system: UnitSystem): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  return `${formatDuration(paceValue(secondsPerKm, system))} /${distanceUnit(system)}`;
}

export function formatPaceShort(secondsPerKm: number, system: UnitSystem): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  return formatDuration(paceValue(secondsPerKm, system));
}

/** m/s -> "11.6 km/h" / "7.2 mph" */
export function formatSpeed(metersPerSecond: number, system: UnitSystem, digits = 1): string {
  if (!Number.isFinite(metersPerSecond) || metersPerSecond <= 0) return '—';
  const kmh = metersPerSecond * 3.6;
  return system === 'metric'
    ? `${kmh.toFixed(digits)} km/h`
    : `${(kmh / 1.609344).toFixed(digits)} mph`;
}

export function speedUnit(system: UnitSystem): string {
  return system === 'metric' ? 'km/h' : 'mph';
}

export function speedValue(metersPerSecond: number, system: UnitSystem): number {
  const kmh = metersPerSecond * 3.6;
  return system === 'metric' ? kmh : kmh / 1.609344;
}

export function formatElevation(meters: number, system: UnitSystem): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0';
  return system === 'metric'
    ? `${Math.round(meters)}`
    : `${Math.round(meters * 3.280839895)}`;
}

export function elevationUnit(system: UnitSystem): string {
  return system === 'metric' ? 'm' : 'ft';
}

/* ------------------------------------------------------------------ mass -- */

export function weightValue(kg: number, system: UnitSystem): number {
  return system === 'metric' ? kg : kg * LB_PER_KG;
}

export function weightUnit(system: UnitSystem): string {
  return system === 'metric' ? 'kg' : 'lb';
}

/** 82.5 kg -> "82.5 kg" / "182 lb" — imperial rounds, half-pounds are noise. */
export function formatWeight(kg: number, system: UnitSystem): string {
  if (!Number.isFinite(kg) || kg <= 0) return system === 'metric' ? '0 kg' : '0 lb';
  return system === 'metric'
    ? `${trimNumber(kg, 1)} kg`
    : `${Math.round(kg * LB_PER_KG)} lb`;
}

export function toKilograms(value: number, system: UnitSystem): number {
  return system === 'metric' ? value : value / LB_PER_KG;
}

/** Weight step for steppers — 1 kg / 2.5 lb, the plates people actually own. */
export function weightStep(system: UnitSystem): number {
  return system === 'metric' ? 1 : 2.5;
}

/* ----------------------------------------------------------------- calorie -- */

export function formatCalories(kcal: number): string {
  if (!Number.isFinite(kcal) || kcal <= 0) return '0';
  return `${Math.round(kcal)}`;
}

/* ------------------------------------------------------------------- time -- */

const TIME_FMT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const LONG_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short' });

/**
 * Every helper in this section takes `Date | number` because the domain stores
 * epoch milliseconds and UI code formats ad-hoc; forcing callers to wrap `new
 * Date(...)` at every call site is noise that invites bugs, not safety.
 */
export type DateInput = Date | number;

export function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function startOfDay(date: DateInput): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: DateInput, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysBetween(a: DateInput, b: DateInput): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-anchored start of the ISO week containing `date`. */
export function startOfWeek(date: DateInput): Date {
  const d = startOfDay(date);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -dow);
}

export function startOfMonth(date: DateInput): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function formatTimeOfDay(date: DateInput): string {
  return TIME_FMT.format(date);
}

export function formatClock(minutesFromMidnight: number): string {
  const total = ((Math.round(minutesFromMidnight) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  return TIME_FMT.format(new Date(2024, 0, 1, h24, m));
}

/** "Today" · "Yesterday" · "Mon" · "12 Mar" — relative first, then absolute. */
export function formatRelativeDay(date: DateInput, now: DateInput = new Date()): string {
  const d = toDate(date);
  const diff = daysBetween(d, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WEEKDAY_FMT.format(d);
  if (d.getFullYear() === toDate(now).getFullYear()) return SHORT_DATE_FMT.format(d);
  return `${SHORT_DATE_FMT.format(d)}, ${d.getFullYear()}`;
}

export function formatFullDate(date: DateInput): string {
  return LONG_DATE_FMT.format(date);
}

export function formatShortDate(date: DateInput): string {
  return SHORT_DATE_FMT.format(date);
}

export function formatMonth(date: DateInput): string {
  return MONTH_FMT.format(date);
}

/** "3 days ago" · "just now" — for activity cards. */
export function formatAgo(date: DateInput, now: DateInput = new Date()): string {
  const seconds = Math.max(0, (toDate(now).getTime() - toDate(date).getTime()) / 1000);
  if (seconds < 3600) return 'just now';
  const hours = seconds / 3600;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = daysBetween(date, now);
  if (days < 7) return `${days}d ago`;
  if (days < 31) return `${Math.floor(days / 7)}w ago`;
  return formatShortDate(date);
}

/** Inverse of `formatDuration` for editing inputs: "4:30" -> 270 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0]! * 60;
  if (nums.length === 2) return nums[0]! * 60 + nums[1]!;
  if (nums.length === 3) return nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
  return null;
}

/** Parses a numeric field, rejecting garbage rather than coerced NaN. */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** "Bench Press" + "overhead" -> "Bench Press · Overhead" (skips empties). */
export function joinMiddleDot(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join('  ·  ');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "12:45" style split for large metric displays, keeping units visually small. */
export function splitMetric(text: string): { value: string; unit?: string } {
  const match = /^(.*?)(?:\s+([^\s]+))$/.exec(text);
  if (!match || !match[2]?.match(/^[a-z/]+$/i)) return { value: text };
  return { value: match[1] ?? text, unit: match[2] };
}
