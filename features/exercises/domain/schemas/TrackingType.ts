import { Schema } from 'effect';

/**
 * What the sets of one exercise in a routine or a workout record: weight, reps and RPE; reps and
 * RPE; or seconds and RPE. These literals are stored in SQLite, the transfer files and the watch
 * documents, so a fourth type is a new literal here plus a branch wherever a set is drawn or summed.
 */
export const TrackingType = Schema.Literal('weightReps', 'repsOnly', 'duration');

export type TrackingType = typeof TrackingType.Type;
