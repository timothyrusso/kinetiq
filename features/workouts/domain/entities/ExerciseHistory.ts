/** One recorded workout's rollup of one exercise. */
export interface ExercisePerformance {
  readonly activityId: string;
  readonly performedAt: number;
  /** As recorded on the workout: a later rename does not rewrite history. */
  readonly exerciseName: string;
  /** Volume across completed sets only, kg. */
  readonly volumeKg: number;
  readonly sets: number;
  readonly completedSets: number;
  /** Heaviest completed set, kg. `0` means bodyweight was the load. */
  readonly topWeightKg: number;
  readonly topReps: number;
  /** Best estimated one-rep max in the workout, or null when no set supports the estimate. */
  readonly estimated1rmKg: number | null;
}

/** One point of the heaviest-weight line: a workout's heaviest completed set. */
interface WeightPoint {
  readonly activityId: string;
  readonly performedAt: number;
  readonly weightKg: number;
}

/** Everything the user has done with one exercise. */
export interface ExerciseHistory {
  /** Newest first. */
  readonly sessions: readonly ExercisePerformance[];
  /**
   * Heaviest completed set per workout, oldest first. Workouts with no weighted set are left out
   * rather than drawn as zero: a dip to 0 kg would read as a collapse that never happened.
   */
  readonly weightTrend: readonly WeightPoint[];
  readonly sessionsCount: number;
  /** Heaviest completed set ever recorded, kg; bodyweight work (0 kg) is excluded. */
  readonly bestWeightKg: number | null;
  readonly bestReps: number | null;
  readonly bestEstimated1rmKg: number | null;
  /** Most volume in a single workout. */
  readonly bestVolumeKg: number | null;
  readonly firstPerformedAt: number | null;
  readonly lastPerformedAt: number | null;
}
