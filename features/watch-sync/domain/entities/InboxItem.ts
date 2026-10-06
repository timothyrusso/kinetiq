/**
 * One entry of the watch's inbox, read: the workout it holds, or why it cannot be saved.
 * `version` is from a newer watch app and kept for an update; `outdated` is from an older watch
 * app, which this phone no longer reads; `invalid` can never be read.
 * Generic over the workout, which `workouts` owns: a domain type never names another feature's.
 */
export interface InboxItem<Workout> {
  readonly id: string;
  readonly read:
    | { readonly ok: true; readonly workout: Workout }
    | { readonly ok: false; readonly reason: 'version' | 'outdated' | 'invalid' };
}
