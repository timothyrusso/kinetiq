/**
 * Row <-> domain codecs. Every JSON column parses defensively: one corrupt row
 * must degrade to a missing field, never blank an entire screen.
 */
import type { Activity, StrengthEntry, WorkoutSession, WorkoutSessionStatus } from '@/domain/types';
import type { ActivityRow, SessionRow } from './rows';

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function stringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    // Cyclic or non-serialisable input must not throw inside a write path.
    return 'null';
  }
}

/** `volume_kg` is written for every recorded session, so its absence marks a damaged row. */
export function rowToActivity(row: ActivityRow): Activity {
  const entries = parseJsonArray<StrengthEntry>(row.entries_json);
  const hasStrength = row.volume_kg !== null;

  return {
    id: row.id,
    kind: 'lift',
    title: row.title,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    caloriesKcal: row.calories_kcal,
    notes: row.notes,
    sourceSessionId: row.source_session_id,
    strength: hasStrength
      ? {
          entries,
          totalVolumeKg: row.volume_kg ?? 0,
          totalSets:
            row.total_sets ??
            entries.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0),
          personalRecords: [],
        }
      : null,
  };
}

const SESSION_STATUSES: readonly WorkoutSessionStatus[] = [
  'active',
  'paused',
  'finished',
  'discarded',
];

export function rowToSession(row: SessionRow): WorkoutSession {
  const status = (SESSION_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as WorkoutSessionStatus)
    : 'active';
  return {
    id: row.id,
    routineId: row.routine_id,
    routineName: row.routine_name,
    startedAt: row.started_at,
    elapsedSeconds: row.elapsed_seconds,
    status,
    entries: parseJsonArray<StrengthEntry>(row.entries_json),
    activeIndex: row.active_index,
    restEndsAt: row.rest_ends_at,
    restDurationSeconds: row.rest_duration,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}
