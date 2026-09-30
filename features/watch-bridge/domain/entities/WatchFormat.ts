/**
 * The two documents that cross between the phone and the Apple Watch.
 *
 * New formats rather than `kinetiq.routines`: that file carries only what a person would write
 * (no routine ids, optional exercise ids), and the return trip needs ids so the phone never has
 * to match a workout to a routine or an exercise by name.
 */
export const WATCH_ROUTINES_FORMAT = 'kinetiq.watch-routines';
export const WATCH_WORKOUT_FORMAT = 'kinetiq.watch-workout';
/**
 * v2 plans every set of a routine item from its own row. A watch app still on v1 refuses a v2
 * snapshot as a newer version, and says so, rather than reading it with sets missing.
 */
export const WATCH_FORMAT_VERSION = 2;
/**
 * The workout versions the phone reads. A v1 workout, from a watch app not yet updated, has the
 * same shape as v2.
 */
export const WATCH_WORKOUT_VERSIONS = [1, WATCH_FORMAT_VERSION] as const;
