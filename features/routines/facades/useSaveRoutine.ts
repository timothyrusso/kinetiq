import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@/features/core/query';
import { refreshRoutine } from '@/features/routines/facades/routineQueryKeys';
import { createRoutine, type NewRoutine } from '@/features/routines/useCases/createRoutine';

/**
 * Saves the routine the builder assembled and returns it as stored, so the caller can open it. A
 * typed name another routine has fails with `RoutineNameTaken`.
 */
export function useSaveRoutine() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: (routine: NewRoutine) => createRoutine(routine),
    onSuccess: saved => refreshRoutine(client, saved.id),
  });
}
