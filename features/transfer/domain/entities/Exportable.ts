/**
 * What the exports read of a recorded workout and of a routine. Structural, because `workouts`
 * and `routines` own those types and a domain type never names another feature's: their
 * entities are passed in as they are, and the compiler checks they still fit. Both are unions on
 * `trackingType`, every set carrying the same tag as its `type`, as the entities are.
 */

/** What every recorded set carries, whatever it records. */
interface RecordedSet {
  readonly index: number;
  readonly completed: boolean;
  readonly rpe: number | null;
}

/** An exercise's recorded sets, of its tracking type. */
type RecordedSets =
  | {
      readonly trackingType: 'weightReps';
      readonly sets: readonly (RecordedSet & {
        readonly type: 'weightReps';
        readonly reps: number;
        readonly weightKg: number;
        readonly estimated1rm: number | null;
      })[];
    }
  | {
      readonly trackingType: 'repsOnly';
      readonly sets: readonly (RecordedSet & { readonly type: 'repsOnly'; readonly reps: number })[];
    }
  | {
      readonly trackingType: 'duration';
      readonly sets: readonly (RecordedSet & { readonly type: 'duration'; readonly durationSeconds: number })[];
    };

/** One exercise of a recorded workout. */
export type ExportableEntry = {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly muscleGroup: string | null;
  readonly restSeconds: number;
  readonly notes: string | null;
} & RecordedSets;

export type ExportableSet = ExportableEntry['sets'][number];

export interface ExportableWorkout {
  readonly id: string;
  readonly title: string;
  readonly startedAt: number;
  readonly durationSeconds: number;
  readonly notes: string | null;
  readonly strength: {
    readonly totalVolumeKg: number;
    readonly totalSets: number;
    readonly entries: readonly ExportableEntry[];
  } | null;
}

/** An item's planned sets, of its tracking type. */
type PlannedSets =
  | {
      readonly trackingType: 'weightReps';
      readonly sets: readonly {
        readonly type: 'weightReps';
        readonly reps: number;
        readonly weightKg: number;
        readonly targetRpe: number | null;
      }[];
    }
  | {
      readonly trackingType: 'repsOnly';
      readonly sets: readonly { readonly type: 'repsOnly'; readonly reps: number; readonly targetRpe: number | null }[];
    }
  | {
      readonly trackingType: 'duration';
      readonly sets: readonly {
        readonly type: 'duration';
        readonly durationSeconds: number;
        readonly targetRpe: number | null;
      }[];
    };

/** One exercise of a routine. */
export type ExportableItem = {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly restSeconds: number;
  readonly notes: string | null;
} & PlannedSets;

export interface ExportableRoutine {
  readonly name: string;
  readonly items: readonly ExportableItem[];
}
