/**
 * The two documents that cross between the phone and the Apple Watch (issue #27).
 *
 * New formats rather than `kinetiq.routines`: that file carries only what a person would write
 * (no routine ids, optional exercise ids), and the return trip needs ids so the phone never has
 * to match a workout to a routine or an exercise by name.
 *
 * On the wire each one travels as `{ format, version, id, payload }` with the document as JSON
 * in `payload`: WatchConnectivity dictionaries take property-list types only, and `null` (a
 * cleared note, an unrecorded RPE) is not one.
 */
import type { UnitSystem } from '@/utils/format';

export const WATCH_ROUTINES_FORMAT = 'kinetiq.watch-routines';
export const WATCH_WORKOUT_FORMAT = 'kinetiq.watch-workout';
export const WATCH_FORMAT_VERSION = 1;

type WatchRoutineItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  /** A number or a range, as on the phone: "8", "8-12". The watch reads it with `repsFromRange`. */
  reps: string;
  weightKg: number;
  restSeconds: number;
  notes: string | null;
};

type WatchRoutine = {
  id: string;
  name: string;
  items: WatchRoutineItem[];
};

/** Phone to watch: every routine, and the unit the watch should show weights in. */
export type WatchRoutinesDocument = {
  format: typeof WATCH_ROUTINES_FORMAT;
  version: typeof WATCH_FORMAT_VERSION;
  exportedAt: string;
  unitSystem: UnitSystem;
  routines: WatchRoutine[];
};

type WatchWorkoutSet = {
  index: number;
  reps: number;
  weightKg: number;
  completed: boolean;
  rpe: number | null;
};

type WatchWorkoutEntry = {
  exerciseId: string;
  exerciseName: string;
  restSeconds: number;
  notes: string | null;
  sets: WatchWorkoutSet[];
};

/**
 * Watch to phone: one finished workout. `CompletedWorkout` minus everything the phone computes
 * (duration, calories, volume, set count, estimated 1RM, records).
 */
export type WatchWorkoutDocument = {
  format: typeof WATCH_WORKOUT_FORMAT;
  version: typeof WATCH_FORMAT_VERSION;
  /** A UUID minted on the watch. The activity id is `watch-<id>`, which makes a replay a no-op. */
  id: string;
  routineId: string | null;
  title: string;
  /** ISO 8601. */
  startedAt: string;
  endedAt: string;
  entries: WatchWorkoutEntry[];
  notes: string | null;
};
