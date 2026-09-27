import { Effect, Layer } from 'effect';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { toAppError } from '@/features/core/error';
import { ScreenWake } from '@/features/workouts/domain/services/ScreenWake';

/** The keep-awake tag the workout holds, so releasing it never releases another holder's. */
const KEEP_AWAKE_TAG = 'kinetiq.workout';

/** `ScreenWake` over expo-keep-awake. */
export const ScreenWakeLive = Layer.succeed(ScreenWake, {
  keepOn: Effect.tryPromise({ try: () => activateKeepAwakeAsync(KEEP_AWAKE_TAG), catch: cause => toAppError(cause) }),
  release: Effect.tryPromise({ try: () => deactivateKeepAwake(KEEP_AWAKE_TAG), catch: cause => toAppError(cause) }),
});
