import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import type { SettingsRow, SettingsSection } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { formatTimer, formatWeight } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import { useSettings } from '@/features/settings';
import type { ParsedItem } from '@/features/transfer/domain/entities/ParsedImport';
import type { ResolvedItem } from '@/features/transfer/domain/entities/ResolvedImport';
import { importable } from '@/features/transfer/domain/utils/matchRules';
import { useImportRoutines } from '@/features/transfer/facades/useImportRoutines';
import { useResolvedImport } from '@/features/transfer/facades/useResolvedImport';
import { useStagedImport } from '@/features/transfer/facades/useStagedImport';

/** `values` as one label when every set has the same one, otherwise as the lowest and the highest. */
function spanLabel(values: readonly number[], label: (value: number) => string): string {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? label(low) : `${label(low)}-${label(high)}`;
}

/** The item's reps, or its time as `m:ss`: one value when every set has it, else the span. */
function targetLabel(item: ParsedItem): string {
  const values = item.sets.map(set => (set.type === 'duration' ? set.durationSeconds : set.reps));
  return item.trackingType === 'duration' ? spanLabel(values, formatTimer) : spanLabel(values, String);
}

/** The first set's load: what a loaded item's preview leads with. */
function firstWeightKg(item: ParsedItem): number {
  const [first] = item.sets;
  return first?.type === 'weightReps' ? first.weightKg : 0;
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
            : item.trackingType === 'weightReps'
              ? t('dataTransfer.itemTargets', {
                  weight: formatWeight(firstWeightKg(item), units),
                  rest: item.restSeconds ?? defaultRest,
                })
              : t('dataTransfer.itemRest', { rest: item.restSeconds ?? defaultRest });
      const count = item.sets.length;
      const value =
        item.trackingType === 'duration'
          ? t('dataTransfer.setsDuration', { sets: count, duration: targetLabel(item) })
          : t('dataTransfer.setsReps', { sets: count, reps: targetLabel(item) });
      return { kind: 'info', key, title, subtitle, value };
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
