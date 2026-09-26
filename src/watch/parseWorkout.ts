/**
 * Reads a `kinetiq.watch-workout` document from the native inbox (issue #27).
 *
 * Everything is checked before use (Stability rule 3): format, version, size, types, and the
 * same bounds the routine editor enforces. A document that fails is never partly saved. The
 * computed fields are derived here exactly as `toCompletedWorkout` derives them for a phone
 * session, except duration, which for a watch workout is wall clock.
 */
import {
  completedSetCount,
  estimateCalories,
  estimatedOneRepMax,
  totalVolumeKg,
} from '@/domain/logic';
import type { CompletedWorkout, StrengthEntry, StrengthSet } from '@/domain/types';
import { IMPORT_LIMITS, ITEM_BOUNDS } from '@/transfer/format';
import type { WatchInboxEntry } from '../../modules/watch-bridge';
import { WATCH_FORMAT_VERSION, WATCH_WORKOUT_FORMAT } from './format';

export type ParsedWorkout =
  | { ok: true; workout: CompletedWorkout }
  /** `version`: a newer watch app; worth keeping until the phone app catches up. */
  | { ok: false; reason: 'version' | 'invalid' };

/** Activity ids of watch workouts, so history can tell them from `session-` ones. */
const watchActivityId = (uuid: string) => `watch-${uuid}`;

const MAX_TITLE = 200;
/** No set a person logs is longer than this; a longer "workout" is a clock gone wrong. */
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const REPS = { min: 0, max: 100 };
const RPE = { min: 0, max: 10 };

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const inRange = (value: unknown, range: { min: number; max: number }): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max;
const isInt = (value: unknown, range: { min: number; max: number }): value is number =>
  inRange(value, range) && Number.isInteger(value);
const nullableText = (value: unknown, max: number): value is string | null =>
  value === null || value === undefined || (typeof value === 'string' && value.length <= max);
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9-]{1,80}$/.test(value);
const time = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

export function parseWatchWorkout(entry: WatchInboxEntry): ParsedWorkout {
  if (entry.format !== WATCH_WORKOUT_FORMAT) return { ok: false, reason: 'invalid' };
  if (entry.version !== WATCH_FORMAT_VERSION) return { ok: false, reason: 'version' };
  if (entry.payload.length === 0 || entry.payload.length > IMPORT_LIMITS.bytes) {
    return { ok: false, reason: 'invalid' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(entry.payload);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isObject(raw)) return { ok: false, reason: 'invalid' };
  if (raw.format !== WATCH_WORKOUT_FORMAT) return { ok: false, reason: 'invalid' };
  if (raw.version !== WATCH_FORMAT_VERSION) return { ok: false, reason: 'version' };
  const workout = toWorkout(raw);
  return workout === null ? { ok: false, reason: 'invalid' } : { ok: true, workout };
}

function toWorkout(raw: Json): CompletedWorkout | null {
  const startedAt = time(raw.startedAt);
  const endedAt = time(raw.endedAt);
  if (!isUuid(raw.id) || startedAt === null || endedAt === null || endedAt < startedAt) return null;
  const durationSeconds = Math.round((endedAt - startedAt) / 1000);
  if (durationSeconds > MAX_DURATION_SECONDS) return null;
  if (typeof raw.title !== 'string' || raw.title.length > MAX_TITLE) return null;
  if (!(raw.routineId === null || raw.routineId === undefined || typeof raw.routineId === 'string')) return null;
  if (!nullableText(raw.notes, ITEM_BOUNDS.notesLength)) return null;
  if (!Array.isArray(raw.entries) || raw.entries.length > IMPORT_LIMITS.itemsPerRoutine) return null;

  const entries: StrengthEntry[] = [];
  for (const item of raw.entries) {
    const entry = toEntry(item);
    if (entry === null) return null;
    entries.push(entry);
  }

  return {
    id: watchActivityId(raw.id),
    routineId: typeof raw.routineId === 'string' ? raw.routineId : null,
    title: raw.title,
    startedAt,
    endedAt,
    durationSeconds,
    caloriesKcal: estimateCalories(durationSeconds),
    entries,
    totalVolumeKg: totalVolumeKg(entries),
    totalSets: completedSetCount(entries),
    notes: typeof raw.notes === 'string' ? raw.notes : null,
  };
}

function toEntry(raw: unknown): StrengthEntry | null {
  if (!isObject(raw)) return null;
  if (typeof raw.exerciseId !== 'string' || raw.exerciseId.length === 0) return null;
  if (typeof raw.exerciseName !== 'string' || raw.exerciseName.length > MAX_TITLE) return null;
  if (!isInt(raw.restSeconds, ITEM_BOUNDS.restSeconds)) return null;
  if (!nullableText(raw.notes, ITEM_BOUNDS.notesLength)) return null;
  if (!Array.isArray(raw.sets) || raw.sets.length === 0 || raw.sets.length > ITEM_BOUNDS.sets.max) return null;
  const sets: StrengthSet[] = [];
  for (const item of raw.sets) {
    if (!isObject(item)) return null;
    if (!isInt(item.index, { min: 0, max: ITEM_BOUNDS.sets.max })) return null;
    if (!isInt(item.reps, REPS) || !inRange(item.weightKg, ITEM_BOUNDS.weightKg)) return null;
    if (typeof item.completed !== 'boolean') return null;
    if (!(item.rpe === null || item.rpe === undefined || inRange(item.rpe, RPE))) return null;
    sets.push({
      index: item.index,
      reps: item.reps,
      weightKg: item.weightKg,
      completed: item.completed,
      // As `withEstimated1rm` in the session engine: completed sets only.
      estimated1rm: item.completed ? estimatedOneRepMax(item.weightKg, item.reps) : null,
      rpe: typeof item.rpe === 'number' ? item.rpe : null,
    });
  }
  return {
    exerciseId: raw.exerciseId,
    exerciseName: raw.exerciseName,
    muscleGroup: null,
    restSeconds: raw.restSeconds,
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    sets,
  };
}
