/**
 * Row <-> domain codecs. Every JSON column parses defensively: one corrupt row
 * must degrade to a missing field, never blank an entire screen.
 */
import type {
  Activity,
  ExerciseSnapshot,
  Routine,
  StrengthEntry,
  WorkoutSession,
  WorkoutSessionStatus,
} from '@/domain/types';
import type {
  ActivityRow,
  ExerciseRow,
  RecordRow,
  RoutineItemRow,
  RoutineRow,
  SessionRow,
} from './rows';

export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function parseStringArray(raw: string | null | undefined): string[] {
  const parsed = parseJsonArray<unknown>(raw);
  return parsed.filter((v): v is string => typeof v === 'string');
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
    seeded: row.seeded === 1,
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

export function rowToExerciseSnapshot(row: ExerciseRow): ExerciseSnapshot {
  return {
    exerciseId: row.id,
    name: row.name,
    instructions: row.instructions,
    category: row.category,
    primaryMuscles: parseStringArray(row.primary_muscles),
    secondaryMuscles: parseStringArray(row.secondary_muscles),
    equipment: parseStringArray(row.equipment),
    imageUrl: row.image_url,
    // Lists must never render an empty box: fall back to whatever art exists.
    thumbnailUrl: row.thumbnail_url ?? row.image_url,
    externalId: row.external_id,
    capturedAt: row.captured_at,
  };
}

export function rowToRecord(row: RecordRow) {
  return {
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    kind: row.kind,
    value: row.value,
    achievedAt: row.achieved_at,
  };
}

/**
 * Joins routine rows with their items. Items are already ordered by the caller's
 * `ORDER BY position`; we sort again defensively because a caller might pass an
 * unordered bucket.
 *
 * `exercise_name` on the item is authoritative: the row stores its own name copy
 * so a routine still reads correctly even if the exercise snapshot is gone.
 * `snapshots` is only a fallback for rows written before that column existed.
 */
export function rowToRoutine(
  row: RoutineRow,
  items: readonly RoutineItemRow[],
  snapshots?: ReadonlyMap<string, ExerciseSnapshot>,
): Routine {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timesCompleted: row.times_completed,
    lastPerformedAt: row.last_performed_at,
    seeded: row.seeded === 1,
    items: sorted.map((item) => ({
      id: item.id,
      exerciseId: item.exercise_id,
      exerciseName:
        item.exercise_name || snapshots?.get(item.exercise_id)?.name || 'Unknown exercise',
      sets: item.sets,
      reps: item.reps,
      weightKg: item.weight_kg,
      restSeconds: item.rest_seconds,
      notes: item.notes,
    })),
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
