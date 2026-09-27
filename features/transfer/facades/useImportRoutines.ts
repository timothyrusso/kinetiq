import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@/features/core/query';
import { tr } from '@/features/core/translations';
import type { ExerciseSnapshot } from '@/features/exercises';
import { routineQueryKeys } from '@/features/routines';
import { getSettings } from '@/features/settings';
import type { ResolvedRoutine } from '@/features/transfer/domain/entities/ResolvedImport';
import { saveImport } from '@/features/transfer/useCases/saveImport';

const fallbackName = (number: number) => tr('dataTransfer.untitledRoutine', { number });

/** Writes the importable routines, with the user's default rest where an item has none. */
export function useImportRoutines() {
  const client = useQueryClient();
  return useEffectMutation({
    mutationFn: (routines: readonly ResolvedRoutine<ExerciseSnapshot>[]) =>
      saveImport(routines, fallbackName, getSettings().defaultRestSeconds),
    onSuccess: () => {
      // NOTE: the routines' own prefix: an import adds routines, and every routine read re-reads.
      void client.invalidateQueries({ queryKey: routineQueryKeys.all });
    },
  });
}
