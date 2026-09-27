/**
 * Effect's `Clock` service, the one source of time for use cases: `yield* Clock.currentTimeMillis`
 * instead of `Date.now()`, so a test moves time with `advanceClock` instead of waiting. The
 * default runtime provides the system clock; `itEffect` provides the `TestClock`.
 */
export { Clock } from 'effect';
