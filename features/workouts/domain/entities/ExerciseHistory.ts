import type { TrackingType } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** One recorded workout's rollup of one exercise, in what its type recorded that day. */
export interface ExercisePerformance {
  readonly activityId: string;
  readonly performedAt: number;
  /** As recorded on the workout: a later rename does not rewrite history. */
  readonly exerciseName: string;
  /** How the exercise was tracked in this workout. */
  readonly trackingType: TrackingType;
  /** Volume across completed loaded sets only, kg; 0 for a type with no load. */
  readonly volumeKg: number;
  readonly sets: number;
  readonly completedSets: number;
  /** Heaviest completed set, kg. `0` means bodyweight was the load, or the type has none. */
  readonly topWeightKg: number;
  /** Most reps in a completed set, loaded or reps-only; 0 for a timed exercise. */
  readonly topReps: number;
  /** Longest completed set, seconds; 0 for a type counted in reps. */
  readonly topDurationSeconds: number;
  /** Best estimated one-rep max in the workout, or null when no set supports the estimate. */
  readonly estimated1rmKg: number | null;
}

/** One point of a history chart: a workout and the value it charts. */
interface TrendPoint {
  readonly activityId: string;
  readonly performedAt: number;
}

/** A workout's heaviest completed loaded set. */
interface WeightPoint extends TrendPoint {
  readonly weightKg: number;
}

/** A reps-only workout's most reps in one set. */
interface RepsPoint extends TrendPoint {
  readonly reps: number;
}

/** A timed workout's longest set, in seconds. */
interface DurationPoint extends TrendPoint {
  readonly durationSeconds: number;
}

/**
 * Everything the user has done with one exercise, kept per tracking type: a workout counts toward
 * the bests and the chart of the type it was tracked as that day.
 */
export interface ExerciseHistory {
  /** Newest first. */
  readonly sessions: readonly ExercisePerformance[];
  /**
   * Heaviest completed set per loaded workout, oldest first. Workouts with no weighted set are
   * left out rather than drawn as zero: a dip to 0 kg would read as a collapse that never happened.
   */
  readonly weightTrend: readonly WeightPoint[];
  /** Most reps in one set per reps-only workout, oldest first. */
  readonly repsTrend: readonly RepsPoint[];
  /** Longest set per timed workout, oldest first. */
  readonly durationTrend: readonly DurationPoint[];
  readonly sessionsCount: number;
  /** Heaviest completed loaded set ever recorded, kg; bodyweight work (0 kg) is excluded. */
  readonly bestWeightKg: number | null;
  /** Most reps in one loaded set. */
  readonly bestReps: number | null;
  /** Most reps in one reps-only set. */
  readonly mostReps: number | null;
  /** Longest timed set, seconds. */
  readonly longestDurationSeconds: number | null;
  readonly bestEstimated1rmKg: number | null;
  /** Most volume in a single workout. */
  readonly bestVolumeKg: number | null;
  readonly firstPerformedAt: number | null;
  readonly lastPerformedAt: number | null;
}
