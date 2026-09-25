/**
 * The file formats Kinetiq writes and reads.
 *
 * ## Two documents, one rule
 *
 * Workouts go out for analysis (a spreadsheet, a notebook, an AI chat). Routines go out AND
 * come back in, which is what lets an AI edit them: export, ask for changes, import the answer.
 * Both carry `format` and `version` so a file can say what it is, and so a later version of
 * the app can read an older file instead of guessing from its shape.
 *
 * ## Only what a person would write
 *
 * A routine item on disk also has an id, a position and a snapshot. None of those are here:
 * an AI cannot know them, and a file that asks for them is a file nobody can author by hand.
 * The importer mints ids, keeps the order of the list, and looks the exercise up.
 */
export const ROUTINES_FORMAT = 'kinetiq.routines';
export const WORKOUTS_FORMAT = 'kinetiq.workouts';
export const FORMAT_VERSION = 1;

/** The same bounds the routine item editor's steppers use (`src/ui/routineItems.tsx`). */
export const ITEM_BOUNDS = {
  sets: { min: 1, max: 20 },
  weightKg: { min: 0, max: 450 },
  restSeconds: { min: 0, max: 600 },
  repsLength: 20,
} as const;

/** Beyond this a file is not a routine collection anyone meant to import. */
export const IMPORT_LIMITS = { routines: 50, itemsPerRoutine: 50, bytes: 1_000_000 } as const;

type RoutineFileItem = {
  /** `wger:<id>` from the public catalog, or a `local:` id from an export. Optional. */
  exerciseId?: string;
  exerciseName: string;
  sets: number;
  /** A number or a range: "8", "8-12". */
  reps: string;
  weightKg: number;
  restSeconds: number;
  notes?: string | null;
};

type RoutineFileRoutine = {
  name: string;
  description?: string | null;
  items: RoutineFileItem[];
};

export type RoutinesFile = {
  format: typeof ROUTINES_FORMAT;
  version: typeof FORMAT_VERSION;
  exportedAt: string;
  routines: RoutineFileRoutine[];
};

type WorkoutFileSet = {
  index: number;
  reps: number;
  weightKg: number;
  completed: boolean;
  rpe: number | null;
  estimated1rmKg: number | null;
};

type WorkoutFileExercise = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  restSeconds: number;
  notes: string | null;
  sets: WorkoutFileSet[];
};

type WorkoutFileWorkout = {
  id: string;
  title: string;
  startedAt: string;
  durationSeconds: number;
  caloriesKcal: number;
  notes: string | null;
  totalVolumeKg: number;
  totalSets: number;
  exercises: WorkoutFileExercise[];
};

export type WorkoutsFile = {
  format: typeof WORKOUTS_FORMAT;
  version: typeof FORMAT_VERSION;
  exportedAt: string;
  /** Weights are always kilograms in the file, whatever the display units. */
  units: { weight: 'kg' };
  workouts: WorkoutFileWorkout[];
};
