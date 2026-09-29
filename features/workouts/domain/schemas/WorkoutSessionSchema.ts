import { Schema } from 'effect';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { StrengthEntrySchema } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** Where a workout in progress stands. Only `active` and `paused` are ever restored. */
export const WorkoutSessionStatusSchema = Schema.Literal('active', 'paused', 'finished', 'discarded');

export type WorkoutSessionStatus = typeof WorkoutSessionStatusSchema.Type;

/**
 * A workout in progress. Written to disk on every change, so a backgrounded or force-quit app
 * restores exactly where the user left off. Its id becomes the activity's id when it is recorded.
 */
export const WorkoutSessionSchema = Schema.Struct({
  id: ActivityId,
  routineId: Schema.NullOr(Schema.String),
  routineName: Schema.String,
  startedAt: Schema.Number,
  // NOTE: accumulated seconds, counted by the session clock rather than read off the wall.
  elapsedSeconds: Schema.Number,
  status: WorkoutSessionStatusSchema,
  entries: Schema.Array(StrengthEntrySchema),
  // NOTE: the exercise the user is on; a restored row may point past the end, so readers clamp.
  activeIndex: Schema.Number,
  // NOTE: the rest's absolute deadline, so a rest that spanned a background still reads right.
  restEndsAt: Schema.NullOr(Schema.Number),
  restDurationSeconds: Schema.NullOr(Schema.Number),
  notes: Schema.NullOr(Schema.String),
  updatedAt: Schema.Number,
  // NOTE: the routine items the workout started with, which tells an exercise removed during it
  // from one added to the routine meanwhile; absent when it did not start from a routine, and on
  // a session started before the finish could update its routine.
  routineItemIds: Schema.optional(Schema.Array(Schema.String)),
});

export type WorkoutSession = typeof WorkoutSessionSchema.Type;
