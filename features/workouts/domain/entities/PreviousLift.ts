/** What the user lifted last time on one exercise. */
export interface PreviousLift {
  readonly exerciseId: string;
  readonly exerciseName: string;
  /** Sets from the most recent workout that included this exercise. */
  readonly sets: readonly { readonly reps: number; readonly weightKg: number; readonly estimated1rm: number | null }[];
  readonly bestEstimated1rm: number | null;
  readonly totalVolumeKg: number;
  readonly performedAt: number;
}
