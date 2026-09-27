import { useEffectMutation } from '@/features/core/query';
import type { ExportTarget } from '@/features/transfer/domain/entities/TransferFormat';
import { exportData } from '@/features/transfer/useCases/exportData';

/** Exports one target to the share sheet. */
export function useExport() {
  return useEffectMutation({ mutationFn: (target: ExportTarget) => exportData(target) });
}
