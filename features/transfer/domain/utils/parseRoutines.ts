import { clamp } from '@/features/core/utils';
import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import {
  type ParsedItem,
  type ParsedRoutine,
  type ParsedSet,
  type ParsedTrackingType,
  type ParseIssue,
  TRACKING_TYPES,
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
 * The link to the public exercise index, which the app's own AI instructions carry in every
 * language. An answer may cite it too, in the prose around its JSON, so the link alone proves
 * nothing: what marks the instructions is the link in text that does not read as JSON. Their
 * example routine is unfenced and followed by the rules, which hold the link and a bracketed
 * column list, so the slice `jsonSlice` takes runs from the example into the rules and never
 * parses. An answer's slice is its JSON alone, read from its code fence when it has one, so
 * brackets in its prose (a markdown link to the index) never reach the parser (`readDocument`).
 */
const AI_PROMPT_SIGNATURE = 'timothyrusso/kinetiq/main/assets/catalog/index.json';

/** The body of each code fence (```json, ```text or ```). */
const CODE_FENCES = /```[a-z]*[^\S\n]*\n([\s\S]*?)```/gi;

/** The text between the first `{` or `[` and the last `}` or `]`, or the text itself. */
function jsonSlice(raw: string): string {
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

function parsed(raw: string): { readonly doc: unknown } | null {
  try {
    return { doc: JSON.parse(jsonSlice(raw)) };
  } catch {
    return null;
  }
}

/**
 * The document in `input`: the first code fence whose body parses, so a fence of prose or shell
 * before it is passed over; else the JSON slice of the whole text, as for an unfenced answer.
 */
function readDocument(input: string): { readonly doc: unknown } | null {
  for (const [, body = ''] of input.matchAll(CODE_FENCES)) {
    const read = parsed(body);
    if (read !== null) return read;
  }
  return parsed(input);
}

function routineList(doc: unknown): unknown[] | null {
  if (Array.isArray(doc)) return doc;
  if (!isObject(doc)) return null;
  if (Array.isArray(doc.routines)) return doc.routines;
  if (Array.isArray(doc.items) || Array.isArray(doc.exercises)) return [doc];
  return null;
}

/**
 * `ex:barbell-squat` or `local:bench-press`. Anything else, an id from a retired catalog
 * included, is no id: the item is matched by its name.
 */
function exerciseIdOf(item: Json, rules: ImportRules): string | null {
  const id = text(item.exerciseId);
  return id !== null && rules.isExerciseId(id) ? id : null;
}

/** A rep text: digits and one hyphen. AIs like en and em dashes, and "x". */
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

/** What an item without a usable count, rep target or time gets: the editor's defaults. */
const DEFAULT_SET_COUNT = 3;
const DEFAULT_REPS = 8;
const DEFAULT_DURATION_SECONDS = 30;

/**
 * The item's tracking type, or null when it names none the app knows. No item of a file from
 * before v3 has one, and a guess from the exercise would plan a plank as weight and reps.
 */
function trackingTypeOf(item: Json): ParsedTrackingType | null {
  return TRACKING_TYPES.find(type => type === item.trackingType) ?? null;
}

/** The values one set may give: a set row, or the item itself for the count shorthand. */
type SetValues = Partial<Record<'reps' | 'weightKg' | 'durationSeconds' | 'targetRpe', unknown>>;

/**
 * A set of `type` from `values`, and whether a default filled a gap. Only the fields the type
 * records are read: a weight on a set counted in reps alone is dropped.
 */
function setOf(
  type: ParsedTrackingType,
  values: SetValues,
  rules: ImportRules,
): { set: ParsedSet; defaulted: boolean } {
  const targetRpe = bounded(number(values.targetRpe), rules.bounds.targetRpe);
  switch (type) {
    case 'weightReps': {
      const reps = repsOf(values.reps, rules);
      const weightKg = weightOf(values.weightKg, rules);
      return { set: { type, reps: reps ?? DEFAULT_REPS, weightKg, targetRpe }, defaulted: reps === null };
    }
    case 'repsOnly': {
      const reps = repsOf(values.reps, rules);
      return { set: { type, reps: reps ?? DEFAULT_REPS, targetRpe }, defaulted: reps === null };
    }
    case 'duration': {
      const seconds = bounded(number(values.durationSeconds), rules.bounds.durationSeconds);
      return {
        set: { type, durationSeconds: seconds ?? DEFAULT_DURATION_SECONDS, targetRpe },
        defaulted: seconds === null,
      };
    }
  }
}

/**
 * An item's planned sets, and whether a default filled a gap. An item lists them as rows
 * (`sets: [{ type, reps, weightKg, targetRpe }]`), cut to the most sets an item holds; the item's
 * type decides what every row records, so a row's own `type` is not read. An item may instead give
 * a count with one set's values beside it, the shorthand of a v1 file that an AI still writes: it
 * becomes that many identical sets, reps on the number a range starts with, with no target RPE.
 * The shape decides, not `version`: an AI often keeps the number of the example it was shown.
 */
function plannedSets(
  item: Json,
  type: ParsedTrackingType,
  rules: ImportRules,
): { sets: ParsedSet[]; defaulted: boolean } {
  const rows = Array.isArray(item.sets) ? item.sets.filter(isObject).slice(0, rules.bounds.sets.max) : [];
  if (rows.length > 0) {
    const read = rows.map(row => setOf(type, row, rules));
    return { sets: read.map(({ set }) => set), defaulted: read.some(({ defaulted }) => defaulted) };
  }
  const count = bounded(number(item.sets), rules.bounds.sets);
  const { set, defaulted } = setOf(type, { ...item, targetRpe: null }, rules);
  return {
    sets: Array.from({ length: count ?? DEFAULT_SET_COUNT }, () => set),
    defaulted: count === null || defaulted,
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
  const trackingType = trackingTypeOf(raw);
  if (trackingType === null) {
    issues.push({ key: 'dataTransfer.issueItemNoType', vars: where });
    return null;
  }

  const { sets, defaulted } = plannedSets(raw, trackingType, rules);
  if (defaulted) issues.push({ key: 'dataTransfer.issueDefaults', vars: where });

  return {
    exerciseId,
    exerciseName: exerciseName ?? '',
    trackingType,
    sets,
    restSeconds: bounded(number(raw.restSeconds), rules.bounds.restSeconds),
    notes: text(raw.notes)?.slice(0, rules.bounds.notesLength) ?? null,
  };
}

/**
 * Why a file gave no routines: it is older than v3 when an item was left out for naming no
 * tracking type, which tells its author what to do (export again from an updated app, or ask the
 * AI again); otherwise it simply has none.
 */
function noRoutines(issues: readonly ParseIssue[]): ParseResult {
  const older = issues.some(issue => issue.key === 'dataTransfer.issueItemNoType');
  return { ok: false, issue: { key: older ? 'dataTransfer.errorOlderFile' : 'dataTransfer.errorNoRoutines' } };
}

/**
 * Reads a routines file: an export, or an AI's answer pasted from the clipboard.
 *
 * Strict about meaning, lenient about wrapping. An AI asked for JSON often wraps it in a code
 * fence or a sentence, so the text between the first `{` or `[` and the last `}` or `]` is what
 * gets parsed, inside the first code fence that holds JSON when there is one (`readDocument`);
 * the document may be the full file, a bare array of routines, or one routine, its sets as rows or
 * as a count (`plannedSets`). What is not guessed is a value: a missing `sets` gets the editor's
 * default and is reported, an out-of-range one is clamped to the editor's bounds, and an item
 * with neither an exercise id nor a name is dropped and reported. Nor is a tracking type: an item
 * without one is dropped and reported, and a file with no item left, a file from before v3, is
 * refused as older (`noRoutines`).
 *
 * Text that is not JSON and carries the index link is the app's own AI instructions pasted back
 * (by mistake, or echoed by the AI around its answer), and is refused as such rather than as text
 * that is not JSON (`AI_PROMPT_SIGNATURE`).
 *
 * Pure and total: it never throws and never touches the database. Matching items to real
 * exercises is `resolveExercisesByName`.
 */
export function parseRoutines(raw: string, rules: ImportRules): ParseResult {
  if (raw.length > rules.limits.bytes) return { ok: false, issue: { key: 'dataTransfer.errorTooLarge' } };
  if (raw.trim() === '') return { ok: false, issue: { key: 'dataTransfer.errorEmpty' } };

  const read = readDocument(raw);
  if (read === null) {
    const isPrompt = raw.includes(AI_PROMPT_SIGNATURE);
    return { ok: false, issue: { key: isPrompt ? 'dataTransfer.errorIsPrompt' : 'dataTransfer.errorNotJson' } };
  }

  const list = routineList(read.doc);
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

  if (routines.length === 0) return noRoutines(issues);
  return { ok: true, routines, issues };
}
