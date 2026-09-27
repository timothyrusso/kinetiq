import { Effect } from 'effect';
import { SchemaStatus } from '@/features/core/sqlite/domain/services/SchemaStatus';
import { clearAllUserData } from '@/features/core/sqlite/useCases/clearAllUserData';

/**
 * The launch's reset: wipes the user's data, keeping the schema and the exercise catalog, then
 * runs the migrations again. A migration that failed on the data it met can pass once that data
 * is gone, and the next launch reads the new report; one that fails again is named again.
 */
export const resetLocalData = Effect.gen(function* () {
  yield* clearAllUserData;
  return yield* (yield* SchemaStatus).remigrate;
});
