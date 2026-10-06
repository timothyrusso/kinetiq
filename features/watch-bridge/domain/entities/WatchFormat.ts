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
 * v3 tags every item and entry with its tracking type and every set with its own `type`. A watch
 * app still on v2 refuses a v3 snapshot as another version, and says so, rather than reading a
 * timed set as weight and reps.
 */
export const WATCH_FORMAT_VERSION = 3;
/**
 * The workout versions the phone reads: v3 only. A v1 or v2 workout has no tracking type, and the
 * phone no longer guesses one.
 */
export const WATCH_WORKOUT_VERSIONS = [WATCH_FORMAT_VERSION] as const;
