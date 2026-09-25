/**
 * Formatting primitives. All domain values are stored canonically in metric
 * (kilograms, seconds); conversion happens only here, at
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

/** 1234 -> "1,234" · 1234567 -> "1.23M" */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimNumber(value / 1_000_000, 1)}M`;
  if (abs >= 10_000) return `${trimNumber(value / 1000, 1)}k`;
  return Math.round(value).toLocaleString('en-US');
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

function toKilograms(value: number, system: UnitSystem): number {
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

/** Monday-anchored start of the ISO week containing `date`. */
export function startOfWeek(date: DateInput): Date {
  const d = startOfDay(date);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -dow);
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

/** "12:45" style split for large metric displays, keeping units visually small. */
export function splitMetric(text: string): { value: string; unit?: string } {
  const match = /^(.*?)(?:\s+([^\s]+))$/.exec(text);
  if (!match || !match[2]?.match(/^[a-z/]+$/i)) return { value: text };
  return { value: match[1] ?? text, unit: match[2] };
}
