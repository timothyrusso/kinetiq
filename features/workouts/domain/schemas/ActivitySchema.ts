import { Schema } from 'effect';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { PersonalRecordSchema } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import { StrengthEntrySchema } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** Kinetiq records lifting sessions only; the kind is kept so a stored row stays self-describing. */
const ActivityKindSchema = Schema.Literal('lift');

/** A recorded workout's sets and the totals derived from them. */
const StrengthMetricsSchema = Schema.Struct({
  entries: Schema.Array(StrengthEntrySchema),
  // NOTE: reps times weight over the completed loaded sets, kilograms; other types add none.
  totalVolumeKg: Schema.Number,
  totalSets: Schema.Number,
  personalRecords: Schema.Array(PersonalRecordSchema),
});

/** A finished, recorded workout: immutable history. */
export const ActivitySchema = Schema.Struct({
  id: ActivityId,
  kind: ActivityKindSchema,
  title: Schema.String,
  startedAt: Schema.Number,
  durationSeconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  // NOTE: the session that produced it, when it came from the tracker.
  sourceSessionId: Schema.NullOr(Schema.String),
  // NOTE: null only for a damaged row, which the detail screen explains rather than hides.
  strength: Schema.NullOr(StrengthMetricsSchema),
});

export type Activity = typeof ActivitySchema.Type;
