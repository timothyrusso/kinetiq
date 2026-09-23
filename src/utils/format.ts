/**
 * Formatting primitives. All domain values are stored canonically in metric
 * (metres, kilograms, seconds-per-kilometre); conversion happens only here, at
 * the moment a value is shown.
 *
 * The parsers live here alongside the formatters (`parseDuration`, `parseNumber`,
 * `repsFromRange`) because they are the same concern seen from the other side, and because
 * a rule like "which number does the rep range '5-8' mean" must have exactly one answer:
 * the programmatic stepper, the planned-volume figure and the session engine all read the
 * same string, and if they disagree the routine screen and the workout screen show two
 * different rep counts for one exercise.
 *
 * Weight conversion is here for the same reason. `weightValue`/`toKilograms` are the only
 * place the lb factor is written; an earlier pass had it inlined in three more files, one
 * under a constant named `LB_PER_LB`.
 */

export type UnitSystem = 'metric' | 'imperial';

const KM = 1000;
const MILE_IN_METERS = 1609.344;
const LB_PER_KG = 2.2046226218;

/* ---------------------------------------------------------------- numbers -- */

/** Trims trailing zeros: 5.00 -> "5", 5.40 -> "5.4", 5.42 -> "5.42" */
export function trimNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function fixed(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

/** 1234 -> "1,234" · 1234567 -> "1.23M" */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';
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

/** 3661 -> "1h 01m" · 2920 -> "48m": for compact chips. */
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
/**
 * A distance with its unit: "5.20 km", "420 m", "3.2 mi", "180 ft".
 *
 * ALWAYS carries the unit, because the unit is not a constant: a short effort reads as
 * metres and a long one as kilometres, so a caller cannot append the right one from the
 * system alone. This used to return a bare number for long distances while still returning
 * "420 m" for short ones, and both halves of that were wrong in their own way: the activity
 * list rendered a naked "0.18", its screen-reader label said "Morning run. 0.18 in 1m", and
 * `formatDistanceWithUnit`: which appended the unit itself: produced "420 m km" for
 * anything under 100 metres.
 *
 * Where the unit is already on screen (a table column headed KM), use `distanceValue`,
 * which returns the bare number in the system's primary unit.
 */
export function formatDistance(meters: number, system: UnitSystem, digits = 2): string {
  const perUnit = system === 'metric' ? KM : MILE_IN_METERS;
  if (meters < perUnit * 0.1) {
    // Short efforts read better in metres/feet than as "0.03 km".
    if (system === 'metric') return `${Math.round(meters)} m`;
    return `${Math.round(meters * 3.280839895)} ft`;
  }
  return `${(meters / perUnit).toFixed(digits)} ${distanceUnit(system)}`;
}


/** Canonical pace is seconds per kilometre. */
export function paceValue(secondsPerKm: number, system: UnitSystem): number {
  return system === 'metric' ? secondsPerKm : secondsPerKm * (MILE_IN_METERS / KM);
}

/** 312 s/km -> "5:12 /km" · imperial converts to s/mi. */
export function formatPace(secondsPerKm: number, system: UnitSystem): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '-';
  return `${formatDuration(paceValue(secondsPerKm, system))} /${distanceUnit(system)}`;
}

export function formatPaceShort(secondsPerKm: number, system: UnitSystem): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '-';
  return formatDuration(paceValue(secondsPerKm, system));
}

/** m/s -> "11.6 km/h" / "7.2 mph" */
export function formatSpeed(metersPerSecond: number, system: UnitSystem, digits = 1): string {
  if (!Number.isFinite(metersPerSecond) || metersPerSecond <= 0) return '-';
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

/** 82.5 kg -> "82.5 kg" / "182 lb": imperial rounds, half-pounds are noise. */
export function formatWeight(kg: number, system: UnitSystem): string {
  if (!Number.isFinite(kg) || kg <= 0) return system === 'metric' ? '0 kg' : '0 lb';
  return system === 'metric'
    ? `${trimNumber(kg, 1)} kg`
    : `${Math.round(kg * LB_PER_KG)} lb`;
}

export function toKilograms(value: number, system: UnitSystem): number {
  return system === 'metric' ? value : value / LB_PER_KG;
}

/**
 * kg → the number to show in a weight control the user edits.
 *
 * The pair of this and `weightFromDisplayValue` is the whole units story for a stepper, and
 * both directions round for a reason:
 *
 * - Going out, an imperial value is stored in kg, so 60 kg is 132.277… lb. Showing that
 *   verbatim makes a control whose step is 2.5 sit on a number its own steps cannot produce,
 *   and the next tap appears to change the weight by nothing. Rounding to the nearest tenth
 *: or to a whole number when the step is a whole number: keeps the displayed value on
 *   the grid the step moves along.
 * - Coming back, the division produces another long decimal, and storing it means two
 *   routines that are both "135 lb" differ at the sixth significant figure and never compare
 *   equal. Two places is below the resolution of a barbell and above the resolution of a
 *   fraction of a kilogram.
 *
 * This replaced four inlined copies of `* 2.2046226218` / `/ 2.2046226218`, one of which was
 * in a local constant named `LB_PER_LB`.
 */
export function weightDisplayValue(kg: number, system: UnitSystem, step: number): number {
  if (system === 'metric') return kg;
  return Number(weightValue(kg, system).toFixed(step < 1 ? 1 : 0));
}

/** The inverse: what the user typed in their unit, in the kilograms everything is stored in. */
export function weightFromDisplayValue(value: number, system: UnitSystem): number {
  return Number(toKilograms(value, system).toFixed(2));
}

/** Weight step for steppers, 1 kg / 2.5 lb, the plates people actually own. */
export function weightStep(system: UnitSystem): number {
  return system === 'metric' ? 1 : 2.5;
}

/**
 * The number a programmed rep target means when a single number is needed.
 *
 * A routine stores reps as text because people program ranges ("5-8"), singles ("1+"), and
 * efforts that are not numbers at all ("AMRAP"). Anything that needs arithmetic: the
 * planned-volume figure, the session-length estimate, the stepper on the editor sheet, the
 * first set the workout engine opens with: takes the leading integer.
 *
 * The fallback is 8, not 0: "AMRAP" still occupies roughly a set's worth of time and a real
 * effort, and reading it as zero would report a five-exercise routine as a two-minute one
 * and offer a stepper starting at nothing. The 100 cap is what makes the value safe to hand
 * to a stepper whose maximum is 100: without it, a stray "1000" in stored data would open a
 * control that cannot represent the number it was given.
 */
export function repsFromRange(reps: string): number {
  const first = /(\d+)/.exec(reps)?.[1];
  const parsed = first === undefined ? Number.NaN : Number.parseInt(first, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 8;
}

/* ----------------------------------------------------------------- calorie -- */

export function formatCalories(kcal: number): string {
  if (!Number.isFinite(kcal) || kcal <= 0) return '0';
  return `${Math.round(kcal)}`;
}

/* ------------------------------------------------------------------- time -- */

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

/**
 * `"2 exercises"`, `"1 exercise"`: the number included.
 *
 * Two near-identical jobs used to hide behind one name called `pluralize`, and half the
 * call sites assumed the other half's contract: a template would write
 * `${total} ${pluralize(total, 'exercise')}` and render "904 904 exercises", while
 * `Rest timer · ${pluralize(days, 'day')} a week` needed the number the helper supplies.
 * Every reader checked the helper and still got it wrong, because the name describes the
 * grammar and not the return value. The names now say what comes out.
 */
export function countNoun(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * `"exercises"`, `"exercise"`: the number *not* included, for when the template already
 * prints it, which is most of the time: the count is usually a separate, styled, or
 * localised piece (`4,562 kg`, `4,562 <Txt>sets</Txt>`).
 */
export function pluralWord(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** "12:45" style split for large metric displays, keeping units visually small. */
export function splitMetric(text: string): { value: string; unit?: string } {
  const match = /^(.*?)(?:\s+([^\s]+))$/.exec(text);
  if (!match || !match[2]?.match(/^[a-z/]+$/i)) return { value: text };
  return { value: match[1] ?? text, unit: match[2] };
}
