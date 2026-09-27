import { Schema } from 'effect';
import { entriesFromColumn, entriesToColumn } from '@/features/workouts/data/adapters/decodeRows';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';

/** The `activities` columns every read selects, in the insert's order. */
export const ACTIVITY_COLUMNS = `
  id, kind, title, started_at, duration_seconds, calories_kcal, notes,
  source_session_id, entries_json, volume_kg, total_sets, created_at`;

/** A row of the `activities` table. */
export const ActivityRow = Schema.Struct({
  id: ActivityId,
  kind: Schema.String,
  title: Schema.String,
  started_at: Schema.Number,
  duration_seconds: Schema.Number,
  calories_kcal: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  source_session_id: Schema.NullOr(Schema.String),
  entries_json: Schema.NullOr(Schema.String),
  volume_kg: Schema.NullOr(Schema.Number),
  total_sets: Schema.NullOr(Schema.Number),
  created_at: Schema.Number,
});

/**
 * A stored row as a workout. `volume_kg` is written for every recorded workout, so its absence
 * marks a damaged row, which reads with no strength data. A row's stored records are not read
 * back: the records table holds the bests.
 */
export function activityFromRow(row: typeof ActivityRow.Type): Activity {
  const entries = entriesFromColumn(row.entries_json);
  return {
    id: row.id,
    kind: 'lift',
    title: row.title,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    caloriesKcal: row.calories_kcal,
    notes: row.notes,
    sourceSessionId: row.source_session_id,
    strength:
      row.volume_kg === null
        ? null
        : {
            entries,
            totalVolumeKg: row.volume_kg,
            totalSets:
              row.total_sets ?? entries.reduce((acc, entry) => acc + entry.sets.filter(set => set.completed).length, 0),
            personalRecords: [],
          },
  };
}

/** The bound values of the activity insert, in its column order. `created_at` is the start time. */
export function activityToRow(activity: Activity): (string | number | null)[] {
  return [
    activity.id,
    activity.kind,
    activity.title,
    activity.startedAt,
    activity.durationSeconds,
    activity.caloriesKcal,
    activity.notes,
    activity.sourceSessionId,
    activity.strength ? entriesToColumn(activity.strength.entries) : null,
    activity.strength ? activity.strength.totalVolumeKg : null,
    activity.strength ? activity.strength.totalSets : null,
    activity.startedAt,
  ];
}
