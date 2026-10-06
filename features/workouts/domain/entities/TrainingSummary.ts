/** One week of training in a summary. */
export interface WeekSummary {
  /** Local Monday at midnight. */
  readonly weekStart: number;
  /** Local label, e.g. "May 12". */
  readonly label: string;
  readonly workouts: number;
  readonly durationSeconds: number;
  /** Volume in kg, over the loaded sets only: reps-only and timed sets carry none. */
  readonly volumeKg: number;
}

/** The weekly training summary: Profile's last-four-weeks tiles. */
export interface TrainingSummary {
  readonly rangeWeeks: number;
  /**
   * Oldest first, so a chart reads left to right as time and `at(-1)` is this week. Getting the
   * direction wrong is silent, which is why it is stated here.
   */
  readonly weeks: readonly WeekSummary[];
  readonly totals: {
    readonly workouts: number;
    readonly durationSeconds: number;
    readonly volumeKg: number;
  };
  /** Distinct calendar days with at least one workout, inside the window. */
  readonly activeDays: number;
  /** Longest streak of days with a workout inside the window. */
  readonly bestStreak: number;
  /** Days with a workout over days elapsed in the window, 0 to 1. */
  readonly consistency: number;
  /** False when nothing is recorded at all: a different empty state from an empty window. */
  readonly hasAnyHistory: boolean;
}

/** One square of the training grid: minutes trained on a day, or a day that has not come yet. */
export interface TrainingDay {
  /** Local midnight, or null for a day after today. */
  readonly dayStart: number | null;
  readonly value: number;
}

/** The training grid: minutes per day, the last weeks ending with this one. */
export interface TrainingHeatmap {
  /** Oldest first, from a Monday, `weeks * 7` long. */
  readonly days: readonly TrainingDay[];
  readonly workouts: number;
}
