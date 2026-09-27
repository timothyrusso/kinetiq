import { Context, type Effect } from 'effect';
import type { UnexpectedError } from '@/features/core/error';

/** Keeps the screen on while a workout is on screen, so the rest timer is there between sets. */
export class ScreenWake extends Context.Tag('workouts/ScreenWake')<
  ScreenWake,
  {
    /** Keeps the screen from sleeping until `release`; a device that refuses is an `UnexpectedError`. */
    readonly keepOn: Effect.Effect<void, UnexpectedError>;
    /** Lets the screen sleep again. */
    readonly release: Effect.Effect<void, UnexpectedError>;
  }
>() {}
