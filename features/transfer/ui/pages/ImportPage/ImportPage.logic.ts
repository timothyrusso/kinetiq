import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import type { SettingsRow, SettingsSection } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { formatWeight } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import { useSettings } from '@/features/settings';
import type { ParsedSet } from '@/features/transfer/domain/entities/ParsedImport';
import type { ResolvedItem } from '@/features/transfer/domain/entities/ResolvedImport';
import { importable } from '@/features/transfer/domain/utils/matchRules';
import { useImportRoutines } from '@/features/transfer/facades/useImportRoutines';
import { useResolvedImport } from '@/features/transfer/facades/useResolvedImport';
import { useStagedImport } from '@/features/transfer/facades/useStagedImport';

/** The item's reps: one number when every set has it, otherwise the fewest and the most. */
function repsLabel(sets: readonly ParsedSet[]): string {
  const reps = sets.map(set => set.reps);
  const low = Math.min(...reps);
  const high = Math.max(...reps);
  return low === high ? `${low}` : `${low}-${high}`;
}

/**
 * Import preview: what a pasted or picked routines file will become, before anything is saved.
 * Nothing is written until Import, which is what makes it safe to paste whatever an AI produced
 * and look. Every change on the way in is visible: an item matched under a different name shows
 * the name it was asked for, an item that matched nothing says why, and a default or a clamped
 * value is listed in the footer. Silently rewriting the file would leave the user unable to tell
 * a good answer from a bad one.
 */
export function useImportPageLogic() {
  const { t } = useT();
  const router = useRouter();
  const units = useSettings(settings => settings.unitSystem);
  const defaultRest = useSettings(settings => settings.defaultRestSeconds);
  const staged = useStagedImport();
  const { data: routines, isPending: matching, refetch } = useResolvedImport(staged);
  const { mutate: save, isPending: saving, isError: saveFailed } = useImportRoutines();

  const ready = useMemo(() => (routines ? importable(routines) : []), [routines]);

  const confirm = useCallback(() => {
    if (!routines) return;
    save(routines, {
      onSuccess: () => {
        haptics.success();
        router.dismissTo(routes.workoutTab());
      },
      onError: () => haptics.warning(),
    });
  }, [router, routines, save]);
  const retry = useCallback(() => void refetch(), [refetch]);

  const itemRow = useCallback(
    (item: ResolvedItem<ExerciseSnapshot>, key: string): SettingsRow => {
      const { match } = item;
      const title = match.status === 'missing' ? item.exerciseName || item.exerciseId || '' : match.snapshot.name;
      const subtitle =
        match.status === 'missing'
          ? t('dataTransfer.missingNotFound')
          : match.status === 'closest' && item.exerciseName !== ''
            ? t('dataTransfer.matchedFrom', { name: item.exerciseName })
            : t('dataTransfer.itemTargets', {
                weight: formatWeight(item.sets[0]?.weightKg ?? 0, units),
                rest: item.restSeconds ?? defaultRest,
              });
      return {
        kind: 'info',
        key,
        title,
        subtitle,
        value: t('dataTransfer.setsReps', { sets: item.sets.length, reps: repsLabel(item.sets) }),
      };
    },
    [defaultRest, t, units],
  );

  const sections = useMemo<SettingsSection[]>(() => {
    if (!staged)
      return [{ key: 'empty', rows: [{ kind: 'info', key: 'empty', title: t('dataTransfer.nothingStaged') }] }];
    if (matching)
      return [{ key: 'loading', rows: [{ kind: 'info', key: 'loading', title: t('dataTransfer.matching') }] }];
    if (!routines) {
      return [
        {
          key: 'error',
          rows: [
            { kind: 'info', key: 'error', title: t('dataTransfer.matchFailed') },
            { kind: 'button', key: 'retry', title: t('common.retry'), onPress: retry },
          ],
        },
      ];
    }

    const missing = routines.reduce((n, r) => n + r.items.filter(i => i.match.status === 'missing').length, 0);
    const notes = [
      ...staged.issues.map(issue => t(issue.key, issue.vars)),
      ...(missing > 0 ? [t('dataTransfer.missingSummary', { count: missing })] : []),
      ...(saveFailed ? [t('dataTransfer.saveFailed')] : []),
    ];

    const list: SettingsSection[] = [
      {
        key: 'confirm',
        footer: notes.length > 0 ? notes.join('\n') : undefined,
        rows: [
          {
            kind: 'button',
            key: 'import',
            title:
              ready.length === 0
                ? t('dataTransfer.nothingToImport')
                : t('dataTransfer.importCount', { count: ready.length }),
            disabled: ready.length === 0 || saving,
            onPress: confirm,
          },
        ],
      },
    ];
    routines.forEach((routine, index) => {
      list.push({
        key: `routine-${index}`,
        title: routine.name ?? t('dataTransfer.untitledRoutine', { number: index + 1 }),
        rows: routine.items.map((item, i) => itemRow(item, `item-${index}-${i}`)),
      });
    });
    return list;
  }, [confirm, itemRow, matching, ready.length, retry, routines, saveFailed, saving, staged, t]);

  return { derived: { title: t('dataTransfer.previewTitle'), sections } };
}
