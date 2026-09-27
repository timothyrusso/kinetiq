import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

/**
 * The personal records in the `records` table: the current best per exercise and kind, with no
 * history behind it, so a record read back has no `previousValue`.
 */
export class RecordRepository extends Context.Tag('workouts/RecordRepository')<
  RecordRepository,
  {
    /** The records held for `exerciseId`, by kind. */
    readonly forExercise: (exerciseId: string) => Effect.Effect<readonly PersonalRecord[], SqlError | DecodeError>;
    /**
     * Keeps each candidate that beats the stored best, or equals it more recently (then only the
     * date moves), so replaying an older workout never downgrades a record. Opens no transaction:
     * the caller's decides.
     */
    readonly upsertBests: (records: readonly PersonalRecord[]) => Effect.Effect<void, SqlError | DecodeError>;
  }
>() {}
