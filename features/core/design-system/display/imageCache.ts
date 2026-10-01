/**
 * How exercise art is cached, in one place because three components draw it.
 *
 * `memory-disk`: memory so a scrolling list does not decode the same thumbnail twice. The photos
 * are bundled with the app, so they show with no network either way; the disk tier only spares a
 * second decode of a file memory has dropped.
 */
export const EXERCISE_IMAGE_CACHE = 'memory-disk' as const;
