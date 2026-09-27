import { useEffectMutation } from '@/features/core/query';
import { clearAllUserData } from '@/features/core/sqlite';

/**
 * The launch's reset: wipes the user's data, keeping the schema and the exercise catalog, over
 * the connection the runtime opened, whatever state the migrations left the schema in.
 */
export function useResetLocalData() {
  return useEffectMutation({ mutationFn: () => clearAllUserData });
}
