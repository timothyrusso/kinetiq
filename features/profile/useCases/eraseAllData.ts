import { Effect } from 'effect';
import { BackgroundSync } from '@/features/core/lifecycle';
import { clearAllUserData } from '@/features/core/sqlite';

/**
 * Wipes the user's data, keeping the schema and the exercise catalog, then pushes to what mirrors
 * it: the watch's copy of the routines empties with the phone's. A push, not a sync: a workout
 * still waiting in the watch inbox would otherwise be saved straight back into the history the
 * user just erased. A failed wipe changes nothing and pushes nothing.
 */
export const eraseAllData = Effect.gen(function* () {
  yield* clearAllUserData;
  yield* (yield* BackgroundSync).push;
});
