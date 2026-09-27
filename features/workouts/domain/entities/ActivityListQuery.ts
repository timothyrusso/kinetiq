/** Which recorded workouts to read, and in what order. Every bound is optional. */
export interface ActivityListQuery {
  /** Newest first (the default) or oldest first, by start time and then id. */
  readonly order?: 'desc' | 'asc';
  /** Earliest start time to include, unix ms. */
  readonly from?: number;
  /** Latest start time to include, unix ms. */
  readonly to?: number;
  readonly limit?: number;
  readonly offset?: number;
}
