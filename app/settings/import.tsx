/**
 * Import preview: what a pasted or picked routines file will become, before anything is saved.
 *
 * ## Nothing is written until Import
 *
 * The file has already been parsed; this screen looks up each exercise (on the device first,
 * then in the catalog) and shows the result. Leaving without tapping Import leaves the database
 * exactly as it was, which is what makes it safe to paste whatever an AI produced and look.
 *
 * ## Every change on the way in is visible
 *
 * An item that matched a different name shows the name it was asked for; an item that matched
 * nothing says why (not found, or offline); a missing value that got a default is listed in the
 * footer, and a clamped one shows its clamped number. A routines file is the user's, or their AI's, and silently rewriting it would
 * leave them unable to tell a good answer from a bad one.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsRow, type SettingsSection } from '@/ui/controls/SettingsList';
import { routes } from '@/navigation/nav';
import { useImportRoutines, useResolvedImport } from '@/queries/useTransfer';
import { importable, type ResolvedItem } from '@/transfer/resolveRoutines';
import { clearStagedImport, stagedImport } from '@/transfer/stagedImport';
import { useSettings } from '@/settings';
import { formatWeight } from '@/utils/format';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';

export default function ImportPreviewScreen() {
  const { t } = useT();
  const router = useRouter();
  const units = useSettings((s) => s.unitSystem);
  const defaultRest = useSettings((s) => s.defaultRestSeconds);

  // Read once: the staged import is fixed for this screen's lifetime. See `stagedImport`.
  const [staged] = useState(stagedImport);
  useEffect(() => clearStagedImport, []);

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

  const itemRow = useCallback(
    (item: ResolvedItem, key: string): SettingsRow => {
      const { match } = item;
      const title = match.status === 'missing' ? item.exerciseName || item.exerciseId || '' : match.snapshot.name;
      let subtitle: string;
      if (match.status === 'missing') {
        subtitle = match.offline ? t('dataTransfer.missingOffline') : t('dataTransfer.missingNotFound');
      } else if (match.status === 'closest' && item.exerciseName !== '') {
        subtitle = t('dataTransfer.matchedFrom', { name: item.exerciseName });
      } else {
        subtitle = t('dataTransfer.itemTargets', {
          weight: formatWeight(item.weightKg, units),
          rest: item.restSeconds ?? defaultRest,
        });
      }
      return {
        kind: 'info',
        key,
        title,
        subtitle,
        value: t('dataTransfer.setsReps', { sets: item.sets, reps: item.reps }),
      };
    },
    [defaultRest, t, units],
  );

  const sections = useMemo<SettingsSection[]>(() => {
    if (!staged) {
      return [{ key: 'empty', rows: [{ kind: 'info', key: 'empty', title: t('dataTransfer.nothingStaged') }] }];
    }
    if (matching) {
      return [{ key: 'loading', rows: [{ kind: 'info', key: 'loading', title: t('dataTransfer.matching') }] }];
    }
    if (!routines) {
      return [
        {
          key: 'error',
          rows: [
            { kind: 'info', key: 'error', title: t('dataTransfer.matchFailed') },
            { kind: 'button', key: 'retry', title: t('common.retry'), onPress: () => void refetch() },
          ],
        },
      ];
    }

    const missing = routines.reduce((n, r) => n + r.items.filter((i) => i.match.status === 'missing').length, 0);
    const notes = [
      ...staged.issues.map((issue) => t(issue.key, issue.vars)),
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
  }, [confirm, itemRow, matching, ready.length, refetch, routines, saveFailed, saving, staged, t]);

  return (
    <>
      <ScreenHeader title={t('dataTransfer.previewTitle')} />
      <SettingsList sections={sections} />
    </>
  );
}
