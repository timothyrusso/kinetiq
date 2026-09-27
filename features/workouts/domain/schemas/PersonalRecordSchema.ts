import { Schema } from 'effect';

/** What a record measures: an estimated one-rep max, a session's volume, or the most reps. */
export const PersonalRecordKindSchema = Schema.Literal('est1rm', 'volume', 'maxReps');

export type PersonalRecordKind = typeof PersonalRecordKindSchema.Type;

/** A best for one exercise and one kind. */
export const PersonalRecordSchema = Schema.Struct({
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  kind: PersonalRecordKindSchema,
  // NOTE: kilograms for est1rm and volume, reps for maxReps.
  value: Schema.Number,
  achievedAt: Schema.Number,
  // NOTE: the best it beat, when a workout just set it; the stored records keep no history, so null.
  previousValue: Schema.NullOr(Schema.Number),
});

export type PersonalRecord = typeof PersonalRecordSchema.Type;
