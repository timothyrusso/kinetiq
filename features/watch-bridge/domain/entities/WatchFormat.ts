/**
 * The two documents that cross between the phone and the Apple Watch.
 *
 * New formats rather than `kinetiq.routines`: that file carries only what a person would write
 * (no routine ids, optional exercise ids), and the return trip needs ids so the phone never has
 * to match a workout to a routine or an exercise by name.
 */
export const WATCH_ROUTINES_FORMAT = 'kinetiq.watch-routines';
export const WATCH_WORKOUT_FORMAT = 'kinetiq.watch-workout';
export const WATCH_FORMAT_VERSION = 1;
