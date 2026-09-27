import { useEffectMutation } from '@/features/core/query';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { useSessionStore } from '@/features/workouts/state/sessionStore';
import { discardSession } from '@/features/workouts/useCases/discardSession';

/**
 * Throws the workout in progress away. The store lets it go only once its row is deleted: a
 * discard that failed on disk would come back at the next launch, so it stays on screen instead.
 */
export function useDiscardSession() {
  return useEffectMutation({
    mutationFn: (id: ActivityId) => discardSession(id),
    onSuccess: (_done, id) => useSessionStore.getState().ended(id),
  });
}
