import { Effect } from 'effect';
import { BackgroundSync } from '@/features/core/lifecycle';
import { clearAllUserData } from '@/features/core/sqlite';

/**
 * Wipes the user's data, keeping the schema and the exercise catalog, then syncs what mirrors
 * it: the watch's copy of the routines empties with the phone's. A failed wipe changes nothing
 * and syncs nothing.
 */
export const eraseAllData = Effect.gen(function* () {
  yield* clearAllUserData;
  yield* (yield* BackgroundSync).sync;
});
