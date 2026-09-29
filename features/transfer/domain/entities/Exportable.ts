/**
 * What the exports read of a recorded workout and of a routine. Structural, because `workouts`
 * and `routines` own those types and a domain type never names another feature's: their
 * entities are passed in as they are, and the compiler checks they still fit.
 */
export interface ExportableWorkout {
  readonly id: string;
  readonly title: string;
  readonly startedAt: number;
  readonly durationSeconds: number;
  readonly notes: string | null;
  readonly strength: {
    readonly totalVolumeKg: number;
    readonly totalSets: number;
    readonly entries: readonly {
      readonly exerciseId: string;
      readonly exerciseName: string;
      readonly muscleGroup: string | null;
      readonly restSeconds: number;
      readonly notes: string | null;
      readonly sets: readonly {
        readonly index: number;
        readonly reps: number;
        readonly weightKg: number;
        readonly completed: boolean;
        readonly rpe: number | null;
        readonly estimated1rm: number | null;
      }[];
    }[];
  } | null;
}

export interface ExportableRoutine {
  readonly name: string;
  readonly items: readonly {
    readonly exerciseId: string;
    readonly exerciseName: string;
    readonly sets: readonly {
      readonly reps: number;
      readonly weightKg: number;
    }[];
    readonly restSeconds: number;
    readonly notes: string | null;
  }[];
}
