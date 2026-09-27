import { useCallback, useMemo, useState } from 'react';
import type { SettingsSection } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import { useDataSummary } from '@/features/profile/facades/useDataSummary';
import { useEraseAllData } from '@/features/profile/facades/useEraseAllData';

/**
 * `CATALOG_PROVIDER` is a machine identifier ('wger'): right for data, wrong for a sentence.
 * Mapped here rather than changed at the source: human labels are not the catalog's job.
 */
const LABELLED_PROVIDERS: Record<string, string> = {
  wger: 'wger Workout Manager',
};

/**
 * About: what this build is, where the exercise data comes from, and how to get rid of it. The
 * catalog is named because it is someone else's data, and because exercises are stored as local
 * snapshots precisely so it can vanish without taking the user's routines with it. Erasing is
 * confirmed with the app's one confirmation idiom, and the copy spells out what is destroyed.
 */
export function useAboutPageLogic() {
  const { t } = useT();
  const summary = useDataSummary();
  const erase = useEraseAllData();
  const [confirming, setConfirming] = useState(false);

  const askErase = useCallback(() => {
    haptics.warning();
    setConfirming(true);
  }, []);
  const keep = useCallback(() => setConfirming(false), []);
  const { mutate } = erase;
  const confirmErase = useCallback(
    () =>
      mutate(undefined, {
        onSuccess: () => haptics.success(),
        onError: () => haptics.warning(),
        onSettled: () => setConfirming(false),
      }),
    [mutate],
  );

  const sections = useMemo<SettingsSection[]>(
    () => [
      {
        key: 'build',
        // NOTE: the product name, the one string that is not translated.
        title: 'Kinetiq',
        footer: t('about.storageNote'),
        rows: [
          { kind: 'info', key: 'version', title: t('about.version'), value: summary.version ?? t('about.unknown') },
          {
            kind: 'info',
            key: 'appId',
            title: t('about.appId'),
            subtitle: t('about.appIdHint'),
            value: summary.appId ?? t('about.unknown'),
          },
        ],
      },
      {
        key: 'catalog',
        title: t('about.catalog'),
        footer: `${t('about.catalogNote')}\n\n${t('about.localNote')}`,
        rows: [
          {
            kind: 'info',
            key: 'provider',
            title: LABELLED_PROVIDERS[summary.catalogProvider] ?? summary.catalogProvider,
            subtitle: t('about.catalogLicence'),
          },
        ],
      },
      {
        key: 'device',
        title: t('about.onThisDevice'),
        rows: [
          ...(summary.activitiesLoading
            ? [{ kind: 'info' as const, key: 'counting', title: t('about.activities'), value: t('about.counting') }]
            : summary.activityCount === 0
              ? [{ kind: 'info' as const, key: 'none', title: t('about.nothingStored') }]
              : [
                  {
                    kind: 'info' as const,
                    key: 'workouts',
                    title: t('about.kindLift'),
                    value: String(summary.activityCount),
                  },
                ]),
          {
            kind: 'info',
            key: 'routines',
            title: t('about.routines'),
            subtitle: t('about.routinesHint'),
            value: summary.routinesLoading ? t('about.counting') : String(summary.routineCount),
          },
        ],
      },
      {
        key: 'reset',
        title: t('about.reset'),
        footer: `${t('about.eraseNote')}\n\n${t('about.builtWith')}`,
        rows: [{ kind: 'button', key: 'erase', title: t('about.eraseAll'), destructive: true, onPress: askErase }],
      },
    ],
    [askErase, summary, t],
  );

  return {
    state: { confirming, erasing: erase.isPending },
    derived: {
      title: t('about.title'),
      sections,
      eraseMessage: t('about.eraseMessage', {
        activities: t('about.activityCount', { count: summary.activityCount }),
        routines: t('about.routineCount', { count: summary.routineCount }),
      }),
    },
    effects: { confirmErase, keep },
  };
}
