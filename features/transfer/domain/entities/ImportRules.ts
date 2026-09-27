/** An inclusive range. */
interface Bounds {
  readonly min: number;
  readonly max: number;
}

/**
 * What an import is checked against: the limits and the bounds the routine editor's steppers use
 * and the Apple Watch enforces, and which exercise ids are real. Handed in, because they belong
 * to `watch-bridge` and `exercises`.
 */
export interface ImportRules {
  readonly limits: { readonly bytes: number; readonly routines: number; readonly itemsPerRoutine: number };
  readonly bounds: {
    readonly sets: Bounds;
    readonly weightKg: Bounds;
    readonly restSeconds: Bounds;
    readonly repsLength: number;
    readonly notesLength: number;
  };
  /** A `wger:` or a `local:` id, as the app stores them. */
  readonly isExerciseId: (id: string) => boolean;
}
