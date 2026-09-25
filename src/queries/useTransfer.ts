/**
 * Import and export, as the data screens use them.
 *
 * Exports read the repositories at the moment of the tap rather than a cached list: an export
 * is a copy of what is on disk now, and the history cache only holds what Home has drawn.
 *
 * The exercise lookup for a staged import is a query so the preview gets loading, error and
 * retry states for free, and so the lookups are abandoned (via the abort signal) when the
 * preview is dismissed half-way. It is never cached past the preview: `gcTime: 0`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { activityRepository, routineRepository } from '@/persistence';
import { invalidateRoutines } from '@/query/invalidation';
import { queryKeys } from '@/query/keys';
import { getSettings } from '@/settings/store';
import { tr } from '@/i18n/tr';
import {
  exportFileName,
  routinesDocument,
  setsCsv,
  shareFile,
  workoutsDocument,
} from '@/transfer/exportData';
import { resolveRoutines, saveImported, type ResolvedRoutine } from '@/transfer/resolveRoutines';
import type { StagedImport } from '@/transfer/stagedImport';

export type ExportTarget = 'workoutsJson' | 'setsCsv' | 'routinesJson';

async function runExport(target: ExportTarget): Promise<void> {
  switch (target) {
    case 'workoutsJson': {
      const activities = await activityRepository.list({ order: 'asc' });
      const body = JSON.stringify(workoutsDocument(activities), null, 2);
      return shareFile(exportFileName('workouts', 'json'), body, 'json');
    }
    case 'setsCsv': {
      const activities = await activityRepository.list({ order: 'asc' });
      return shareFile(exportFileName('sets', 'csv'), setsCsv(activities), 'csv');
    }
    case 'routinesJson': {
      const routines = await routineRepository.list();
      const body = JSON.stringify(routinesDocument(routines), null, 2);
      return shareFile(exportFileName('routines', 'json'), body, 'json');
    }
  }
}

export function useExport() {
  return useMutation({ mutationFn: runExport });
}

export function useResolvedImport(staged: StagedImport | null) {
  return useQuery({
    queryKey: queryKeys.transfer.resolve(staged?.id ?? 'none'),
    queryFn: ({ signal }) => resolveRoutines(staged?.routines ?? [], signal),
    enabled: staged !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
}

export function useImportRoutines() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (routines: readonly ResolvedRoutine[]) =>
      saveImported(
        routines,
        { fallback: (number) => tr('dataTransfer.untitledRoutine', { number }) },
        getSettings().defaultRestSeconds,
      ),
    onSuccess: () => invalidateRoutines(client),
  });
}
