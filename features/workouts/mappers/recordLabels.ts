import type { TKey } from '@/features/core/translations';
import { tr } from '@/features/core/translations';
import { formatTimer, formatWeight, type UnitSystem } from '@/features/core/utils';
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
  mostReps: 'records.mostReps',
  longestDuration: 'records.longestDuration',
};

/** A record's value in its own unit: reps for a rep record, `m:ss` for a timed one, else weight. */
export function formatRecordValue(kind: PersonalRecordKind, value: number, units: UnitSystem): string {
  switch (kind) {
    case 'maxReps':
    case 'mostReps':
      return tr('details.repsValue', { reps: Math.round(value) });
    case 'longestDuration':
      return formatTimer(value);
    case 'est1rm':
    case 'volume':
      return formatWeight(value, units);
  }
}
