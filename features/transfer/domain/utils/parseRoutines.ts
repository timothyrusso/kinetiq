import { clamp } from '@/features/core/utils';
import type { ImportRules } from '@/features/transfer/domain/entities/ImportRules';
import type { ParsedItem, ParsedRoutine, ParseIssue } from '@/features/transfer/domain/entities/ParsedImport';

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

/** Reps as the editor stores them: digits and one hyphen. AIs like en and em dashes, and "x". */
function repsOf(value: unknown, rules: ImportRules): string | null {
  const raw = typeof value === 'number' ? String(Math.round(value)) : text(value);
  if (raw === null) return null;
  const cleaned = raw.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, '');
  return /^\d{1,3}(-\d{1,3})?$/.test(cleaned) ? cleaned.slice(0, rules.bounds.repsLength) : null;
}

function bounded(value: number | null, bounds: { min: number; max: number }): number | null {
  return value === null ? null : clamp(Math.round(value), bounds.min, bounds.max);
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

  const sets = bounded(number(raw.sets), rules.bounds.sets);
  const reps = repsOf(raw.reps, rules);
  if (sets === null || reps === null) issues.push({ key: 'dataTransfer.issueDefaults', vars: where });
  const weightKg = number(raw.weightKg) ?? 0;

  return {
    exerciseId,
    exerciseName: exerciseName ?? '',
    sets: sets ?? 3,
    reps: reps ?? '8-12',
    weightKg: clamp(Math.round(weightKg * 4) / 4, rules.bounds.weightKg.min, rules.bounds.weightKg.max),
    restSeconds: bounded(number(raw.restSeconds), rules.bounds.restSeconds),
    notes: text(raw.notes)?.slice(0, rules.bounds.notesLength) ?? null,
  };
}

/**
 * Reads a routines file: an export, or an AI's answer pasted from the clipboard.
 *
 * Strict about meaning, lenient about wrapping. An AI asked for JSON often wraps it in a code
 * fence or a sentence, so the text between the first `{` or `[` and the last `}` or `]` is what
 * gets parsed; the document may be the full file, a bare array of routines, or one routine. What
 * is not guessed is a value: a missing `sets` gets the editor's default and is reported, an
 * out-of-range one is clamped to the editor's bounds, and an item with neither an exercise id
 * nor a name is dropped and reported.
 *
 * Pure and total: it never throws and never touches the database. Matching items to real
 * exercises is `resolveExercisesByName`.
 */
export function parseRoutines(raw: string, rules: ImportRules): ParseResult {
  if (raw.length > rules.limits.bytes) return { ok: false, issue: { key: 'dataTransfer.errorTooLarge' } };
  if (raw.trim() === '') return { ok: false, issue: { key: 'dataTransfer.errorEmpty' } };

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
