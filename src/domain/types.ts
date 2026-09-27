/**
 * Domain models. These are the app's own vocabulary: nothing here mirrors a wger
 * response, and nothing in the UI imports an API DTO. Conversion happens once, in
 * the api layer's mappers.
 *
 * Canonical units: metres, kilograms, seconds, kilocalories. Conversion for
 * display happens only in `src/utils/format.ts`.
 */

/** Kinetiq records lifting sessions only; the kind is kept so stored rows stay self-describing. */
export type ActivityKind = 'lift';

type StrengthMetrics = {
  entries: StrengthEntry[];
  /** Sum of sets x reps x weight, kg. */
  totalVolumeKg: number;
  totalSets: number;
  personalRecords: PersonalRecord[];
};

export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  kind: PersonalRecordKind;
  /** Weight in kg for 1RM/est1RM/volume, reps for rep records. */
  value: number;
  achievedAt: number;
  previousValue: number | null;
};

export type PersonalRecordKind = 'est1rm' | 'volume' | 'maxReps';

export type StrengthSet = {
  index: number;
  reps: number;
  /** Kilograms. Bodyweight entries store 0 and read as bodyweight. */
  weightKg: number;
  completed: boolean;
  /** Estimated one-rep max via Epley, computed on write. */
  estimated1rm: number | null;
  rpe: number | null;
};

export type StrengthEntry = {
  /** Snapshot id: see `ExerciseSnapshot`. */
  exerciseId: string;
  exerciseName: string;
  /** Present for legacy rows; snapshots are authoritative. */
  muscleGroup: string | null;
  sets: StrengthSet[];
  notes: string | null;
  /** Rest seconds captured at session time. */
  restSeconds: number;
};

/** A finished, recorded activity. Immutable history. */
export type Activity = {
  id: string;
  kind: ActivityKind;
  title: string;
  /** Unix ms at which the activity began. */
  startedAt: number;
  durationSeconds: number;
  caloriesKcal: number;
  notes: string | null;
  /** Session that produced this activity, when it came from the tracker. */
  sourceSessionId: string | null;
  strength: StrengthMetrics | null;
};

/* ------------------------------------------------------------- exercises -- */

/** Moved to `@/features/exercises`: this re-export keeps legacy imports building until the owning child deletes it. */
export type { Exercise, ExerciseSnapshot } from '@/features/exercises';

/* --------------------------------------------------------------- routine -- */

/** Moved to `@/features/routines`: this re-export keeps legacy imports building until the owning child deletes it. */
export type { Routine, RoutineItem } from '@/features/routines';

/* ---------------------------------------------------------------- session -- */

export type WorkoutSessionStatus = 'active' | 'paused' | 'finished' | 'discarded';

/**
 * In-flight workout. Written to disk on every mutation so a backgrounded or
 * force-quit app restores exactly where the user left off.
 */
export type WorkoutSession = {
  id: string;
  routineId: string | null;
  routineName: string;
  startedAt: number;
  /** Accumulated foreground seconds, excluding rest-timer time. */
  elapsedSeconds: number;
  status: WorkoutSessionStatus;
  entries: StrengthEntry[];
  /** Index of the exercise the user is on. */
  activeIndex: number;
  restEndsAt: number | null;
  restDurationSeconds: number | null;
  notes: string | null;
  updatedAt: number;
};

/** A session after it has been converted to history. */
export type CompletedWorkout = {
  id: string;
  routineId: string | null;
  title: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  caloriesKcal: number;
  entries: StrengthEntry[];
  totalVolumeKg: number;
  totalSets: number;
  notes: string | null;
};
