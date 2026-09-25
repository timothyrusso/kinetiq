/**
 * Export: turns what is on the device into files, and hands them to the share sheet.
 *
 * ## Pure builders, one side effect
 *
 * The three `*Document` / `*Csv` functions are pure over domain objects, so the file a user
 * gets is decided by data alone. `shareFile` is the only part that touches the disk or the
 * OS, and it writes to the cache directory: the share sheet needs a real file to hand over,
 * and nothing about an export is worth keeping once it has been handed over.
 *
 * ## Demo workouts stay behind
 *
 * Seeded history exists so a first launch is not an empty screen. In an analysis it is noise
 * that looks exactly like data, so the workout exports drop it. Routines are exported whether
 * seeded or not: a seeded routine the user trains with is their routine.
 *
 * ## CSV is one row per set
 *
 * The JSON is nested (workout, exercise, set) because that is what the data is. A spreadsheet
 * wants a flat table, and the set is the smallest fact every other number is a sum of, so a
 * row per set is the table every pivot can be built from.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Activity, Routine } from '@/domain/types';
import {
  FORMAT_VERSION,
  ROUTINES_FORMAT,
  WORKOUTS_FORMAT,
  type RoutinesFile,
  type WorkoutsFile,
} from './format';

export type ExportKind = 'json' | 'csv';

const MIME: Record<ExportKind, { mimeType: string; UTI: string }> = {
  json: { mimeType: 'application/json', UTI: 'public.json' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
};

function recorded(activities: readonly Activity[]): Activity[] {
  return activities.filter((a) => !a.seeded);
}

export function workoutsDocument(activities: readonly Activity[], now = Date.now()): WorkoutsFile {
  return {
    format: WORKOUTS_FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date(now).toISOString(),
    units: { weight: 'kg' },
    workouts: recorded(activities).map((a) => ({
      id: a.id,
      title: a.title,
      startedAt: new Date(a.startedAt).toISOString(),
      durationSeconds: a.durationSeconds,
      caloriesKcal: a.caloriesKcal,
      notes: a.notes,
      totalVolumeKg: a.strength?.totalVolumeKg ?? 0,
      totalSets: a.strength?.totalSets ?? 0,
      exercises: (a.strength?.entries ?? []).map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        muscleGroup: e.muscleGroup,
        restSeconds: e.restSeconds,
        notes: e.notes,
        sets: e.sets.map((s) => ({
          index: s.index,
          reps: s.reps,
          weightKg: s.weightKg,
          completed: s.completed,
          rpe: s.rpe,
          estimated1rmKg: s.estimated1rm,
        })),
      })),
    })),
  };
}

const CSV_HEADER = [
  'workout_id',
  'started_at',
  'workout',
  'exercise_id',
  'exercise',
  'muscle_group',
  'set',
  'reps',
  'weight_kg',
  'completed',
  'rpe',
  'e1rm_kg',
] as const;

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function setsCsv(activities: readonly Activity[]): string {
  const lines: string[] = [CSV_HEADER.join(',')];
  for (const a of recorded(activities)) {
    const startedAt = new Date(a.startedAt).toISOString();
    for (const e of a.strength?.entries ?? []) {
      for (const s of e.sets) {
        lines.push(
          [
            a.id,
            startedAt,
            a.title,
            e.exerciseId,
            e.exerciseName,
            e.muscleGroup,
            s.index + 1,
            s.reps,
            s.weightKg,
            s.completed,
            s.rpe,
            s.estimated1rm === null ? null : Math.round(s.estimated1rm * 10) / 10,
          ]
            .map(csvCell)
            .join(','),
        );
      }
    }
  }
  // CRLF is what RFC 4180 specifies and what Excel expects; every other reader accepts it.
  return `${lines.join('\r\n')}\r\n`;
}

export function routinesDocument(routines: readonly Routine[], now = Date.now()): RoutinesFile {
  return {
    format: ROUTINES_FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date(now).toISOString(),
    routines: routines.map((r) => ({
      name: r.name,
      items: r.items.map((i) => ({
        exerciseId: i.exerciseId,
        exerciseName: i.exerciseName,
        sets: i.sets,
        reps: i.reps,
        weightKg: i.weightKg,
        restSeconds: i.restSeconds,
        notes: i.notes,
      })),
    })),
  };
}

/** `kinetiq-workouts-2026-09-25.json`: sortable, and says what it is when it lands in Files. */
export function exportFileName(stem: string, kind: ExportKind, now = Date.now()): string {
  const day = new Date(now).toISOString().slice(0, 10);
  return `kinetiq-${stem}-${day}.${kind}`;
}

export async function shareFile(name: string, content: string, kind: ExportKind): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, MIME[kind]);
}
