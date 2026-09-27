import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import {
  compactNumber,
  formatCalories,
  formatDuration,
  type UnitSystem,
  weightUnit,
  weightValue,
} from '@/features/core/utils';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { formatRecordValue, RECORD_LABEL } from '@/features/workouts/mappers/recordLabels';

const NO_ENTRIES: readonly StrengthEntry[] = [];
const NO_RECORDS: readonly PersonalRecord[] = [];

/**
 * A recorded workout's summary metrics, each with what to say when it is missing, and the records
 * it set, worded like the exercise page words them.
 */
export function useActivityStrengthLogic(activity: Activity, units: UnitSystem) {
  const { t } = useT();
  const entries = activity.strength?.entries ?? NO_ENTRIES;
  const records = activity.strength?.personalRecords ?? NO_RECORDS;
  const planned = entries.reduce((total, entry) => total + entry.sets.length, 0);
  const completed = entries.reduce((total, entry) => total + entry.sets.filter(set => set.completed).length, 0);
  const volume = activity.strength?.totalVolumeKg ?? 0;

  const metrics = useMemo(
    () => ({
      duration: formatDuration(activity.durationSeconds),
      volume: volume > 0 ? `${compactNumber(weightValue(volume, units))} ${weightUnit(units)}` : null,
      volumeNote: volume > 0 ? undefined : t('activity.bodyweightWork'),
      sets: planned > 0 ? `${completed}/${planned}` : null,
      setsNote: t(planned > 0 ? 'activity.completed' : 'activity.noSets'),
      exercises: entries.length > 0 ? `${entries.length}` : null,
      exercisesNote: entries.length > 0 ? undefined : t('activity.nothingAdded'),
      calories: activity.caloriesKcal > 0 ? formatCalories(activity.caloriesKcal) : null,
      caloriesNote: activity.caloriesKcal > 0 ? undefined : t('activity.noEstimate'),
    }),
    [activity.caloriesKcal, activity.durationSeconds, completed, entries.length, planned, t, units, volume],
  );

  const recordRows = useMemo(
    () =>
      records.map(record => ({
        key: `${record.exerciseId}-${record.kind}`,
        name: record.exerciseName,
        detail:
          t(RECORD_LABEL[record.kind]) +
          (record.previousValue === null
            ? t('activity.firstOfKind')
            : t('activity.upFrom', { value: formatRecordValue(record.kind, record.previousValue, units) })),
        value: formatRecordValue(record.kind, record.value, units),
      })),
    [records, t, units],
  );

  // NOTE: keyed by position too: the same exercise can be in a workout twice.
  const cards = useMemo(
    () => entries.map((entry, index) => ({ key: `${entry.exerciseId}-${index}`, entry })),
    [entries],
  );

  const openExercise = useCallback((exerciseId: string) => {
    router.push(routes.exerciseDetail(exerciseId));
  }, []);

  return { derived: { metrics, recordRows, cards }, effects: { openExercise } };
}
