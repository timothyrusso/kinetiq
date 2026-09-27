import { useEffectMutation } from '@/features/core/query';
import { localId } from '@/features/core/utils';
import type { ImportSource } from '@/features/transfer/domain/entities/TransferFormat';
import { useStagedImportStore } from '@/features/transfer/state/stagedImportStore';
import { readImport } from '@/features/transfer/useCases/readImport';

/**
 * Reads and parses an import, and stages it for the preview. Settles `true` when there is one to
 * preview, `false` when the user backed out of the picker.
 */
export function useReadImport() {
  return useEffectMutation({
    mutationFn: (source: ImportSource) => readImport(source),
    onSuccess: read => {
      if (read !== null) useStagedImportStore.getState().stage({ id: localId('imp'), ...read });
    },
  });
}
