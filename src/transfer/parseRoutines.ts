/**
 * Reads a routines file: an export, or an AI's answer pasted from the clipboard.
 *
 * ## Strict about meaning, lenient about wrapping
 *
 * An AI asked for JSON often wraps it in a code fence or a sentence ("Here is your routine:").
 * That wrapping is stripped: the text between the first `{` or `[` and the last `}` or `]` is
 * what gets parsed. The document itself may be the full file, a bare array of routines, or a
 * single routine, because all three are unambiguous.
 *
 * What is NOT guessed is a value. A missing `sets` gets the editor's default and is reported,
 * an out-of-range one is clamped to the editor's bounds (the preview shows the clamped number),
 * and an item with neither an exercise id nor a name is dropped and reported.
 *
 * ## No exercise lookups here
 *
 * This is pure, synchronous and total: it never throws and never touches the database or the
 * network. Matching items to real exercises is `resolveRoutines`, which is async and can fail
 * for reasons (offline) that have nothing to do with whether the file is well formed.
 */
import type { TKey, TVars } from '@/i18n';
import { externalIdOf, isLocalExerciseId } from '@/domain/exerciseId';
import { clamp } from '@/utils/functional';
import { IMPORT_LIMITS, ITEM_BOUNDS } from './format';

export type ParsedItem = {
  exerciseId: string | null;
  exerciseName: string;
  sets: number;
  reps: string;
  weightKg: number;
  /** Null means "use the user's default rest", decided at import time. */
  restSeconds: number | null;
  notes: string | null;
};

export type ParsedRoutine = {
  /** Null when the file gave none; the preview names it. */
  name: string | null;
  description: string | null;
  items: ParsedItem[];
};

export type ParseIssue = { key: TKey; vars?: TVars };

export type ParseResult =
  | { ok: true; routines: ParsedRoutine[]; issues: ParseIssue[] }
  | { ok: false; issue: ParseIssue };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
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
function exerciseIdOf(item: Json): string | null {
  const raw = item.exerciseId ?? item.wgerId;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return `wger:${raw}`;
  const id = text(raw);
  if (id === null) return null;
  if (/^\d+$/.test(id)) return `wger:${id}`;
  return externalIdOf(id) !== null || isLocalExerciseId(id) ? id : null;
}

/** Reps as the editor stores them: digits and one hyphen. AIs like en dashes and "x". */
function repsOf(value: unknown): string | null {
  const raw = typeof value === 'number' ? String(Math.round(value)) : text(value);
  if (raw === null) return null;
  const cleaned = raw.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, '');
  return /^\d{1,3}(-\d{1,3})?$/.test(cleaned) ? cleaned.slice(0, ITEM_BOUNDS.repsLength) : null;
}

function bounded(value: number | null, bounds: { min: number; max: number }): number | null {
  return value === null ? null : clamp(Math.round(value), bounds.min, bounds.max);
}

function parseItem(raw: unknown, routine: number, position: number, issues: ParseIssue[]): ParsedItem | null {
  const where = { routine, item: position };
  if (!isObject(raw)) {
    issues.push({ key: 'dataTransfer.issueItemSkipped', vars: where });
    return null;
  }
  const exerciseId = exerciseIdOf(raw);
  const exerciseName = text(raw.exerciseName) ?? text(raw.name) ?? text(raw.exercise);
  if (exerciseName === null && exerciseId === null) {
    issues.push({ key: 'dataTransfer.issueItemSkipped', vars: where });
    return null;
  }

  const sets = bounded(number(raw.sets), ITEM_BOUNDS.sets);
  const reps = repsOf(raw.reps);
  if (sets === null || reps === null) {
    issues.push({ key: 'dataTransfer.issueDefaults', vars: where });
  }
  const weightKg = number(raw.weightKg) ?? 0;

  return {
    exerciseId,
    exerciseName: exerciseName ?? '',
    sets: sets ?? 3,
    reps: reps ?? '8-12',
    weightKg: clamp(Math.round(weightKg * 4) / 4, ITEM_BOUNDS.weightKg.min, ITEM_BOUNDS.weightKg.max),
    restSeconds: bounded(number(raw.restSeconds), ITEM_BOUNDS.restSeconds),
    notes: text(raw.notes),
  };
}

export function parseRoutines(raw: string): ParseResult {
  if (raw.length > IMPORT_LIMITS.bytes) return { ok: false, issue: { key: 'dataTransfer.errorTooLarge' } };
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
  if (list.length > IMPORT_LIMITS.routines) {
    issues.push({ key: 'dataTransfer.issueTooMany', vars: { count: IMPORT_LIMITS.routines } });
  }

  const routines: ParsedRoutine[] = [];
  list.slice(0, IMPORT_LIMITS.routines).forEach((entry, index) => {
    const number = index + 1;
    const rawItems = isObject(entry) ? (entry.items ?? entry.exercises) : null;
    if (!isObject(entry) || !Array.isArray(rawItems) || rawItems.length === 0) {
      issues.push({ key: 'dataTransfer.issueRoutineSkipped', vars: { routine: number } });
      return;
    }
    const items = rawItems
      .slice(0, IMPORT_LIMITS.itemsPerRoutine)
      .map((item, i) => parseItem(item, number, i + 1, issues))
      .filter((item): item is ParsedItem => item !== null);
    if (items.length === 0) {
      issues.push({ key: 'dataTransfer.issueRoutineSkipped', vars: { routine: number } });
      return;
    }
    routines.push({ name: text(entry.name), description: text(entry.description), items });
  });

  if (routines.length === 0) return { ok: false, issue: { key: 'dataTransfer.errorNoRoutines' } };
  return { ok: true, routines, issues };
}
