import { Schema } from 'effect';
import type { ExportableRoutine, ExportableWorkout } from '@/features/transfer/domain/entities/Exportable';
import {
  type ExportFile,
  type ExportKind,
  FORMAT_VERSION,
  ROUTINES_FORMAT,
  WORKOUTS_FORMAT,
} from '@/features/transfer/domain/entities/TransferFormat';
import { RoutinesFileSchema } from '@/features/transfer/domain/schemas/RoutinesFileSchema';
import {
  SETS_CSV_COLUMNS,
  type SetsCsvRow,
  SetsCsvRowSchema,
} from '@/features/transfer/domain/schemas/SetsCsvRowSchema';
import { WorkoutsFileSchema } from '@/features/transfer/domain/schemas/WorkoutsFileSchema';

const encodeWorkouts = Schema.encodeSync(WorkoutsFileSchema);
const encodeRoutines = Schema.encodeSync(RoutinesFileSchema);
const encodeRow = Schema.encodeSync(SetsCsvRowSchema);

/** `kinetiq.workouts` v1 for `activities`, oldest first, as indented JSON. */
export function workoutsJson(activities: readonly ExportableWorkout[], now: number): string {
  const document = encodeWorkouts({
    format: WORKOUTS_FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date(now).toISOString(),
    units: { weight: 'kg' },
    workouts: activities.map(activity => ({
      id: activity.id,
      title: activity.title,
      startedAt: new Date(activity.startedAt).toISOString(),
      durationSeconds: activity.durationSeconds,
      notes: activity.notes,
      totalVolumeKg: activity.strength?.totalVolumeKg ?? 0,
      totalSets: activity.strength?.totalSets ?? 0,
      exercises: (activity.strength?.entries ?? []).map(entry => ({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        muscleGroup: entry.muscleGroup,
        restSeconds: entry.restSeconds,
        notes: entry.notes,
        sets: entry.sets.map(set => ({
          index: set.index,
          reps: set.reps,
          weightKg: set.weightKg,
          completed: set.completed,
          rpe: set.rpe,
          estimated1rmKg: set.estimated1rm,
        })),
      })),
    })),
  });
  return JSON.stringify(document, null, 2);
}

/**
 * `kinetiq.routines` v1 for `routines`, as indented JSON. v1 has one target per item, so an item
 * goes out as its set count with its first set's reps and weight.
 */
export function routinesJson(routines: readonly ExportableRoutine[], now: number): string {
  const document = encodeRoutines({
    format: ROUTINES_FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date(now).toISOString(),
    routines: routines.map(routine => ({
      name: routine.name,
      items: routine.items.map(item => ({
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        sets: item.sets.length,
        reps: `${item.sets[0]?.reps ?? 8}`,
        weightKg: item.sets[0]?.weightKg ?? 0,
        restSeconds: item.restSeconds,
        notes: item.notes,
      })),
    })),
  });
  return JSON.stringify(document, null, 2);
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per set of every workout, oldest first, with a header. */
export function setsCsv(activities: readonly ExportableWorkout[]): string {
  const lines: string[] = [SETS_CSV_COLUMNS.join(',')];
  for (const activity of activities) {
    const startedAt = new Date(activity.startedAt).toISOString();
    for (const entry of activity.strength?.entries ?? []) {
      for (const set of entry.sets) {
        const row: SetsCsvRow = encodeRow({
          workout_id: activity.id,
          started_at: startedAt,
          workout: activity.title,
          exercise_id: entry.exerciseId,
          exercise: entry.exerciseName,
          muscle_group: entry.muscleGroup,
          set: set.index + 1,
          reps: set.reps,
          weight_kg: set.weightKg,
          completed: set.completed,
          rpe: set.rpe,
          e1rm_kg: set.estimated1rm === null ? null : Math.round(set.estimated1rm * 10) / 10,
        });
        lines.push(SETS_CSV_COLUMNS.map(column => csvCell(row[column])).join(','));
      }
    }
  }
  // NOTE: CRLF is what RFC 4180 specifies and what Excel expects; every other reader accepts it.
  return `${lines.join('\r\n')}\r\n`;
}

/** `kinetiq-workouts-2026-09-25.json`: sortable, and says what it is when it lands in Files. */
function exportFileName(stem: string, kind: ExportKind, now: number): string {
  const day = new Date(now).toISOString().slice(0, 10);
  return `kinetiq-${stem}-${day}.${kind}`;
}

/** The file an export target shares. */
export function exportFile(stem: string, kind: ExportKind, content: string, now: number): ExportFile {
  return { name: exportFileName(stem, kind, now), content, kind };
}
