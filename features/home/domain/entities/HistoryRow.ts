/**
 * A row of the history list: a week heading or a workout. Generic over the workout, which
 * `workouts` owns: a domain type never names another feature's.
 */
export type HistoryRow<Activity> =
  | {
      readonly type: 'week';
      readonly key: string;
      readonly label: string;
      readonly count: number;
      readonly first: boolean;
    }
  | { readonly type: 'workout'; readonly activity: Activity };
