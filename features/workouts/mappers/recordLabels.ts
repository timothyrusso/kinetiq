import type { TKey } from '@/features/core/translations';
import { tr } from '@/features/core/translations';
import { formatWeight, type UnitSystem } from '@/features/core/utils';
import type { PersonalRecordKind } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

/**
 * How each record kind reads, as catalog KEYS: this is module scope, where there is no language
 * yet. One table for the three screens that show a record, so the same record is never called
 * two different things. "Most volume", not "Most volume in one exercise", which truncated.
 */
export const RECORD_LABEL: Record<PersonalRecordKind, TKey> = {
  est1rm: 'records.est1rm',
  volume: 'records.volume',
  maxReps: 'records.maxReps',
};

/** A record's value in its own unit: a rep record is reps, every other one weight. */
export function formatRecordValue(kind: PersonalRecordKind, value: number, units: UnitSystem): string {
  return kind === 'maxReps' ? tr('details.repsValue', { reps: Math.round(value) }) : formatWeight(value, units);
}
