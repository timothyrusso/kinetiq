import { Schema } from 'effect';
import { type PersonalRecord, PersonalRecordKindSchema } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

/**
 * A row of the `records` table: the best per exercise and kind. `kind` is read as any text, so a
 * kind this build does not know (written by a newer one) cannot fail the whole read.
 */
export const RecordRow = Schema.Struct({
  exercise_id: Schema.String,
  kind: Schema.String,
  exercise_name: Schema.String,
  value: Schema.Number,
  achieved_at: Schema.Number,
});

const isKind = Schema.is(PersonalRecordKindSchema);

/**
 * The stored bests this build knows how to show, as records. A row of an unknown kind is left
 * out, not failed. The table keeps no history, so nothing says what a best displaced.
 */
export function recordsFromRows(rows: readonly (typeof RecordRow.Type)[]): readonly PersonalRecord[] {
  return rows.flatMap(row =>
    isKind(row.kind)
      ? [
          {
            exerciseId: row.exercise_id,
            exerciseName: row.exercise_name,
            kind: row.kind,
            value: row.value,
            achievedAt: row.achieved_at,
            previousValue: null,
          },
        ]
      : [],
  );
}
