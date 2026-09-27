import { Schema } from 'effect';
import { type PersonalRecord, PersonalRecordKindSchema } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

/** A row of the `records` table: the best per exercise and kind. */
export const RecordRow = Schema.Struct({
  exercise_id: Schema.String,
  kind: PersonalRecordKindSchema,
  exercise_name: Schema.String,
  value: Schema.Number,
  achieved_at: Schema.Number,
});

/** A stored best as a record. The table keeps no history, so nothing says what it displaced. */
export function recordFromRow(row: typeof RecordRow.Type): PersonalRecord {
  return {
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    kind: row.kind,
    value: row.value,
    achievedAt: row.achieved_at,
    previousValue: null,
  };
}
