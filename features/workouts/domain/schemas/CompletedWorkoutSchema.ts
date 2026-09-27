import { Schema } from 'effect';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { StrengthEntrySchema } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** A finished workout on its way into history: a phone session, or one the Apple Watch recorded. */
export const CompletedWorkoutSchema = Schema.Struct({
  id: ActivityId,
  routineId: Schema.NullOr(Schema.String),
  title: Schema.String,
  startedAt: Schema.Number,
  endedAt: Schema.Number,
  durationSeconds: Schema.Number,
  caloriesKcal: Schema.Number,
  entries: Schema.Array(StrengthEntrySchema),
  totalVolumeKg: Schema.Number,
  totalSets: Schema.Number,
  notes: Schema.NullOr(Schema.String),
});

export type CompletedWorkout = typeof CompletedWorkoutSchema.Type;
