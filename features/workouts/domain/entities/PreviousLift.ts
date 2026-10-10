import type { TrackingType } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** One set done last time, in what its type records. */
export type PreviousSet =
  | {
      readonly type: 'weightReps';
      readonly reps: number;
      readonly weightKg: number;
      readonly estimated1rm: number | null;
    }
  | { readonly type: 'repsOnly'; readonly reps: number }
  | { readonly type: 'duration'; readonly durationSeconds: number };

/** What the user did last time on one exercise. */
export interface PreviousLift {
  readonly exerciseId: string;
  readonly exerciseName: string;
  /** How the exercise was tracked last time, which need not be how it is tracked now. */
  readonly trackingType: TrackingType;
  /** Sets from the most recent workout that included this exercise. */
  readonly sets: readonly PreviousSet[];
  /** Best estimated one-rep max over the loaded sets; null for a type with none. */
  readonly bestEstimated1rm: number | null;
  /** Kilograms over the loaded sets; 0 for a type with no load. */
  readonly totalVolumeKg: number;
  readonly performedAt: number;
}
