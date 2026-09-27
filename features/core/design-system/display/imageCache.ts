/**
 * How exercise art is cached, in one place because three components draw it.
 *
 * `memory-disk`: memory so a scrolling list does not decode the same thumbnail twice, disk so an
 * image seen once still shows with no network. The catalog itself is offline by construction;
 * this is what lets its pictures follow, without prefetching some 900 of them up front.
 */
export const EXERCISE_IMAGE_CACHE = 'memory-disk' as const;
