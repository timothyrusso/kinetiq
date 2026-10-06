import { Schema } from 'effect';
import { FORMAT_VERSION, WORKOUTS_FORMAT } from '@/features/transfer/domain/entities/TransferFormat';

/** What every set on disk carries before the values its type records. */
const setHead = {
  index: Schema.Number,
};

const setTail = {
  completed: Schema.Boolean,
  rpe: Schema.NullOr(Schema.Number),
};

/** A loaded set: reps at a weight, with its Epley estimate when it has one. */
const WeightRepsFileSetSchema = Schema.Struct({
  ...setHead,
  type: Schema.Literal('weightReps'),
  reps: Schema.Number,
  weightKg: Schema.Number,
  ...setTail,
  estimated1rmKg: Schema.NullOr(Schema.Number),
});

/** A set counted in reps alone. */
const RepsOnlyFileSetSchema = Schema.Struct({
  ...setHead,
  type: Schema.Literal('repsOnly'),
  reps: Schema.Number,
  ...setTail,
});

/** A timed set. */
const DurationFileSetSchema = Schema.Struct({
  ...setHead,
  type: Schema.Literal('duration'),
  durationSeconds: Schema.Number,
  ...setTail,
});

const exerciseHead = {
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  muscleGroup: Schema.NullOr(Schema.String),
};

const exerciseTail = {
  restSeconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
};

/** One exercise of a workout: a union on `trackingType`, every set repeating it as its `type`. */
const WorkoutFileExerciseSchema = Schema.Union(
  Schema.Struct({
    ...exerciseHead,
    trackingType: Schema.Literal('weightReps'),
    ...exerciseTail,
    sets: Schema.Array(WeightRepsFileSetSchema),
  }),
  Schema.Struct({
    ...exerciseHead,
    trackingType: Schema.Literal('repsOnly'),
    ...exerciseTail,
    sets: Schema.Array(RepsOnlyFileSetSchema),
  }),
  Schema.Struct({
    ...exerciseHead,
    trackingType: Schema.Literal('duration'),
    ...exerciseTail,
    sets: Schema.Array(DurationFileSetSchema),
  }),
);

const WorkoutFileWorkoutSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  startedAt: Schema.String,
  durationSeconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  // NOTE: reps times weight over the completed loaded sets; other types add none.
  totalVolumeKg: Schema.Number,
  totalSets: Schema.Number,
  exercises: Schema.Array(WorkoutFileExerciseSchema),
});

/**
 * `kinetiq.workouts` v3: nested (workout, exercise, set) because that is what the data is. The
 * field order is the file's key order. History only goes out: importing it twice would double
 * every chart and could mint a personal record that was never lifted. v3 is v2 with the tracking
 * type on each exercise and set, and only the values a set's type records; v2 was v1 without the
 * estimated energy of each workout.
 */
export const WorkoutsFileSchema = Schema.Struct({
  format: Schema.Literal(WORKOUTS_FORMAT),
  version: Schema.Literal(FORMAT_VERSION),
  exportedAt: Schema.String,
  // NOTE: weights are always kilograms in the file, whatever the display units.
  units: Schema.Struct({ weight: Schema.Literal('kg') }),
  workouts: Schema.Array(WorkoutFileWorkoutSchema),
});
