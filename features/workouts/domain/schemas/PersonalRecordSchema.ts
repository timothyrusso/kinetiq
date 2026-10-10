import { Schema } from 'effect';

/**
 * What a record measures. A loaded exercise holds an estimated one-rep max, a session's volume and
 * the most reps in a loaded set; a reps-only one the most reps in a set (`mostReps`); a timed one
 * the longest set (`longestDuration`). One exercise trained under several types holds each.
 */
export const PersonalRecordKindSchema = Schema.Literal('est1rm', 'volume', 'maxReps', 'mostReps', 'longestDuration');

export type PersonalRecordKind = typeof PersonalRecordKindSchema.Type;

/** A best for one exercise and one kind. */
export const PersonalRecordSchema = Schema.Struct({
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  kind: PersonalRecordKindSchema,
  // NOTE: kilograms for est1rm and volume, reps for maxReps and mostReps, seconds for longestDuration.
  value: Schema.Number,
  achievedAt: Schema.Number,
  // NOTE: the best it beat, when a workout just set it; the stored records keep no history, so null.
  previousValue: Schema.NullOr(Schema.Number),
});

export type PersonalRecord = typeof PersonalRecordSchema.Type;
