import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@/features/core/query';
import { eraseAllData } from '@/features/profile/useCases/eraseAllData';
import { DEFAULT_SETTINGS, updateSettings } from '@/features/settings';

/**
 * Erases everything the user made. Order matters: the data first, then the caches that describe
 * it, then the settings last: they are the one step that writes back to the database, so resetting
 * them earlier would have the wipe undone by its own next step.
 */
export function useEraseAllData() {
  const queryClient = useQueryClient();
  return useEffectMutation({
    mutationFn: () => eraseAllData,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      updateSettings(DEFAULT_SETTINGS);
    },
  });
}
