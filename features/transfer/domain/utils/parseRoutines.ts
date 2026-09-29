import { clamp } from '@/features/core/utils';
import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import type {
  ParsedItem,
  ParsedRoutine,
  ParsedSet,
  ParseIssue,
} from '@/features/transfer/domain/entities/ParsedImport';

/** A routines file read: the routines and what changed on the way in, or why there are none. */
export type ParseResult =
  | { readonly ok: true; readonly routines: ParsedRoutine[]; readonly issues: ParseIssue[] }
  | { readonly ok: false; readonly issue: ParseIssue };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/**
 * A line only the app's own AI instructions carry, in every language: the wger search they tell the
 * AI to use. A routines document never contains it, so text that does is the instructions pasted
 * back (by mistake, or echoed by the AI), and the example routine inside them is not an answer.
 */
const AI_PROMPT_SIGNATURE = 'wger.de/api/v2/exerciseinfo/?name__search=';

/** The JSON inside a code fence or a sentence, or the text itself. */
function jsonSlice(raw: string): string {
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

function routineList(doc: unknown): unknown[] | null {
  if (Array.isArray(doc)) return doc;
  if (!isObject(doc)) return null;
  if (Array.isArray(doc.routines)) return doc.routines;
  if (Array.isArray(doc.items) || Array.isArray(doc.exercises)) return [doc];
  return null;
}

/** `wger:192`, `local:bench-press`, or a bare catalog number (192). */
function exerciseIdOf(item: Json, rules: ImportRules): string | null {
  const raw = item.exerciseId ?? item.wgerId;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return `wger:${raw}`;
  const id = text(raw);
  if (id === null) return null;
  if (/^\d+$/.test(id)) return `wger:${id}`;
  return rules.isExerciseId(id) ? id : null;
}

/** A v1 rep text: digits and one hyphen. AIs like en and em dashes, and "x". */
function repsTextOf(value: unknown): string | null {
  const raw = text(value);
  if (raw === null) return null;
  const cleaned = raw.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, '');
  return /^\d{1,3}(-\d{1,3})?$/.test(cleaned) ? cleaned : null;
}

function bounded(value: number | null, bounds: { min: number; max: number }): number | null {
  return value === null ? null : clamp(Math.round(value), bounds.min, bounds.max);
}

/** A rep target: a number, or the number a range starts with (`8-12` is 8), clamped. */
function repsOf(value: unknown, rules: ImportRules): number | null {
  const range = repsTextOf(value);
  return bounded(number(value) ?? (range === null ? null : Number.parseInt(range, 10)), rules.bounds.reps);
}

/** Rounded to a quarter kilo, the editor's finest step, and clamped; missing is bodyweight. */
function weightOf(value: unknown, rules: ImportRules): number {
  const { min, max } = rules.bounds.weightKg;
  return clamp(Math.round((number(value) ?? 0) * 4) / 4, min, max);
}

/** What an item without a usable count or rep target gets: the editor's defaults. */
const DEFAULT_SET_COUNT = 3;
const DEFAULT_REPS = 8;

/**
 * An item's planned sets, and whether a default filled a gap. A v2 item lists them as rows
 * (`sets: [{ reps, weightKg, targetRpe }]`), cut to the most sets an item holds. A v1 item gives a
 * count, one rep text and one weight: it becomes that many identical sets on the number the reps
 * start with, with no target RPE. The shape decides, not `version`: an AI often keeps the number
 * of the example it was shown.
 */
function plannedSets(item: Json, rules: ImportRules): { sets: ParsedSet[]; defaulted: boolean } {
  const rows = Array.isArray(item.sets) ? item.sets.filter(isObject).slice(0, rules.bounds.sets.max) : [];
  if (rows.length > 0) {
    const reps = rows.map(row => repsOf(row.reps, rules));
    const sets = rows.map((row, index) => ({
      reps: reps[index] ?? DEFAULT_REPS,
      weightKg: weightOf(row.weightKg, rules),
      targetRpe: bounded(number(row.targetRpe), rules.bounds.targetRpe),
    }));
    return { sets, defaulted: reps.includes(null) };
  }
  const count = bounded(number(item.sets), rules.bounds.sets);
  const reps = repsOf(item.reps, rules);
  const set: ParsedSet = { reps: reps ?? DEFAULT_REPS, weightKg: weightOf(item.weightKg, rules), targetRpe: null };
  return {
    sets: Array.from({ length: count ?? DEFAULT_SET_COUNT }, () => set),
    defaulted: count === null || reps === null,
  };
}

function parseItem(
  raw: unknown,
  routine: number,
  position: number,
  issues: ParseIssue[],
  rules: ImportRules,
): ParsedItem | null {
  const where = { routine, item: position };
  if (!isObject(raw)) {
    issues.push({ key: 'dataTransfer.issueItemSkipped', vars: where });
    return null;
  }
  const exerciseId = exerciseIdOf(raw, rules);
  const exerciseName = text(raw.exerciseName) ?? text(raw.name) ?? text(raw.exercise);
  if (exerciseName === null && exerciseId === null) {
    issues.push({ key: 'dataTransfer.issueItemSkipped', vars: where });
    return null;
  }

  const { sets, defaulted } = plannedSets(raw, rules);
  if (defaulted) issues.push({ key: 'dataTransfer.issueDefaults', vars: where });

  return {
    exerciseId,
    exerciseName: exerciseName ?? '',
    sets,
    restSeconds: bounded(number(raw.restSeconds), rules.bounds.restSeconds),
    notes: text(raw.notes)?.slice(0, rules.bounds.notesLength) ?? null,
  };
}

/**
 * Reads a routines file: an export, or an AI's answer pasted from the clipboard.
 *
 * Strict about meaning, lenient about wrapping. An AI asked for JSON often wraps it in a code
 * fence or a sentence, so the text between the first `{` or `[` and the last `}` or `]` is what
 * gets parsed; the document may be the full file, a bare array of routines, or one routine, in
 * v2 or in v1 (`plannedSets`). What is not guessed is a value: a missing `sets` gets the editor's
 * default and is reported, an out-of-range one is clamped to the editor's bounds, and an item
 * with neither an exercise id nor a name is dropped and reported.
 *
 * The app's own AI instructions are refused before any of that (`AI_PROMPT_SIGNATURE`): they
 * hold an example routine that would otherwise read as one to import.
 *
 * Pure and total: it never throws and never touches the database. Matching items to real
 * exercises is `resolveExercisesByName`.
 */
export function parseRoutines(raw: string, rules: ImportRules): ParseResult {
  if (raw.length > rules.limits.bytes) return { ok: false, issue: { key: 'dataTransfer.errorTooLarge' } };
  if (raw.trim() === '') return { ok: false, issue: { key: 'dataTransfer.errorEmpty' } };
  if (raw.includes(AI_PROMPT_SIGNATURE)) return { ok: false, issue: { key: 'dataTransfer.errorIsPrompt' } };

  let doc: unknown;
  try {
    doc = JSON.parse(jsonSlice(raw));
  } catch {
    return { ok: false, issue: { key: 'dataTransfer.errorNotJson' } };
  }

  const list = routineList(doc);
  if (list === null || list.length === 0) return { ok: false, issue: { key: 'dataTransfer.errorNoRoutines' } };

  const issues: ParseIssue[] = [];
  if (list.length > rules.limits.routines) {
    issues.push({ key: 'dataTransfer.issueTooMany', vars: { count: rules.limits.routines } });
  }

  const routines: ParsedRoutine[] = [];
  list.slice(0, rules.limits.routines).forEach((entry, index) => {
    const routineNumber = index + 1;
    const rawItems = isObject(entry) ? (entry.items ?? entry.exercises) : null;
    if (!isObject(entry) || !Array.isArray(rawItems) || rawItems.length === 0) {
      issues.push({ key: 'dataTransfer.issueRoutineSkipped', vars: { routine: routineNumber } });
      return;
    }
    const items = rawItems
      .slice(0, rules.limits.itemsPerRoutine)
      .map((item, i) => parseItem(item, routineNumber, i + 1, issues, rules))
      .filter((item): item is ParsedItem => item !== null);
    if (items.length === 0) {
      issues.push({ key: 'dataTransfer.issueRoutineSkipped', vars: { routine: routineNumber } });
      return;
    }
    // NOTE: a `description` from an older file is ignored: notes live on each exercise now.
    routines.push({ name: text(entry.name), items });
  });

  if (routines.length === 0) return { ok: false, issue: { key: 'dataTransfer.errorNoRoutines' } };
  return { ok: true, routines, issues };
}
