import { Schema } from 'effect';
import { FORMAT_VERSION, WORKOUTS_FORMAT } from '@/features/transfer/domain/entities/TransferFormat';

const WorkoutFileSetSchema = Schema.Struct({
  index: Schema.Number,
  reps: Schema.Number,
  weightKg: Schema.Number,
  completed: Schema.Boolean,
  rpe: Schema.NullOr(Schema.Number),
  estimated1rmKg: Schema.NullOr(Schema.Number),
});

const WorkoutFileExerciseSchema = Schema.Struct({
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  muscleGroup: Schema.NullOr(Schema.String),
  restSeconds: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  sets: Schema.Array(WorkoutFileSetSchema),
});

const WorkoutFileWorkoutSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  startedAt: Schema.String,
  durationSeconds: Schema.Number,
  caloriesKcal: Schema.Number,
  notes: Schema.NullOr(Schema.String),
  totalVolumeKg: Schema.Number,
  totalSets: Schema.Number,
  exercises: Schema.Array(WorkoutFileExerciseSchema),
});

/**
 * `kinetiq.workouts` v1: nested (workout, exercise, set) because that is what the data is. The
 * field order is the file's key order. History only goes out: importing it twice would double
 * every chart and could mint a personal record that was never lifted.
 */
export const WorkoutsFileSchema = Schema.Struct({
  format: Schema.Literal(WORKOUTS_FORMAT),
  version: Schema.Literal(FORMAT_VERSION),
  exportedAt: Schema.String,
  // NOTE: weights are always kilograms in the file, whatever the display units.
  units: Schema.Struct({ weight: Schema.Literal('kg') }),
  workouts: Schema.Array(WorkoutFileWorkoutSchema),
});
