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
  /** Present for seeded/legacy rows; snapshots are authoritative. */
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
  /** True for rows that came from seed data rather than a real recording. */
  seeded: boolean;
  /** Session that produced this activity, when it came from the tracker. */
  sourceSessionId: string | null;
  strength: StrengthMetrics | null;
};

/* ------------------------------------------------------------- exercises -- */

/**
 * The exercise shape the app actually uses. `source` + `externalId` let us trace
 * a row back to wger, and let a saved routine survive the API disappearing.
 */
export type Exercise = {
  id: string;
  name: string;
  instructions: string | null;
  category: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  imageUrl: string | null;
  /** Smaller/thumbnail image for list rows; falls back to `imageUrl`. */
  thumbnailUrl: string | null;
  videoUrl: string | null;
  source: ExerciseSource;
  /** Remote id, when this originated from the exercise provider. */
  externalId: number | null;
};

type ExerciseSource = 'remote' | 'local';

/**
 * Frozen copy of an exercise stored alongside a routine/session. This is what
 * makes saved routines work with the network off: we never re-fetch to render a
 * routine the user already owns.
 */
export type ExerciseSnapshot = {
  exerciseId: string;
  name: string;
  instructions: string | null;
  category: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  /** Full-size image, used on the detail screen. */
  imageUrl: string | null;
  /**
   * Small variant for list rows. Stored separately because routine lists can
   * show a dozen at once, and fetching full-size art per row is a frame budget
   * spent on pixels nobody can see.
   */
  thumbnailUrl: string | null;
  externalId: number | null;
  capturedAt: number;
};

/** Provider-facing page shape; pagination cursor is provider-agnostic. */
export type ExercisePage = {
  items: Exercise[];
  /** Opaque cursor for the next page; null when exhausted. */
  nextCursor: string | null;
  total: number | null;
};

export type ExerciseFilter = {
  query: string;
  categoryId: number | null;
  equipmentId: number | null;
  muscleId: number | null;
};

export type ExerciseTaxonomy = {
  categories: Taxon[];
  equipment: Taxon[];
  muscles: Taxon[];
};

export type Taxon = { id: number; name: string };

/* --------------------------------------------------------------- routine -- */

export type Routine = {
  id: string;
  name: string;
  items: RoutineItem[];
  createdAt: number;
  updatedAt: number;
  /** How many times this routine has been completed. */
  timesCompleted: number;
  lastPerformedAt: number | null;
  seeded: boolean;
};

export type RoutineItem = {
  id: string;
  exerciseId: string;
  /**
   * Display name carried on the item itself, so a routine still reads correctly
   * if its exercise snapshot row is ever lost. Written from the snapshot at save
   * time.
   */
  exerciseName: string;
  sets: number;
  reps: string;
  /** Kilograms. */
  weightKg: number;
  restSeconds: number;
  notes: string | null;
};

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
