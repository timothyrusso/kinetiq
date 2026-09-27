import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { type MetaItem, useScreenContentBottom } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { fullDateLabel, timeOfDayLabel } from '@/features/core/utils';
import { useSettings } from '@/features/settings';
import { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import { useActivity, useDeleteActivity } from '@/features/workouts/facades/useActivities';
import { activityDisplay } from '@/features/workouts/mappers/activityDisplay';

/** The route's id as an activity id, or `null` when it names none. */
function activityIdOf(raw: string | undefined): ActivityId | null {
  return typeof raw === 'string' && raw.length > 0 ? ActivityId.make(raw) : null;
}

/**
 * One recorded workout, read back, and its delete. The dialog closes only once the delete has
 * landed, so the user arrives on a list that already agrees; on failure it stays up with the
 * reason, and closing it clears that reason, so a reopened dialog does not report an old attempt.
 */
export function useActivityPageLogic() {
  const { t } = useT();
  const params = useLocalSearchParams<{ id: string }>();
  const id = activityIdOf(params.id);
  const bottom = useScreenContentBottom();
  const units = useSettings(settings => settings.unitSystem);
  const query = useActivity(id);
  const activity = query.data ?? null;
  const removal = useDeleteActivity();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: remove, reset: resetRemoval } = removal;
  const confirmDelete = useCallback(() => {
    if (id === null) return;
    remove(id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
    });
  }, [id, remove]);
  const askDelete = useCallback(() => setConfirmingDelete(true), []);
  const cancelDelete = useCallback(() => {
    resetRemoval();
    setConfirmingDelete(false);
  }, [resetRemoval]);
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);

  // NOTE: the spoken sentence comes from the list card's own helper, so the two cannot disagree.
  const hero = useMemo(() => {
    if (activity === null) return null;
    const when: MetaItem[] = [
      { icon: 'calendar', label: fullDateLabel(activity.startedAt) },
      { icon: 'clock', label: timeOfDayLabel(activity.startedAt) },
    ];
    return { when, accessibilityLabel: activityDisplay(activity, units).accessibilityLabel };
  }, [activity, units]);

  const contentInset = useMemo(() => ({ paddingBottom: bottom }), [bottom]);

  return {
    state: {
      activity,
      units,
      isLoading: query.isPending,
      error: query.isError ? query.error : null,
      confirmingDelete,
      deleting: removal.isPending,
    },
    derived: {
      title: activity?.title ?? t('activity.fallbackTitle'),
      hero,
      deleteMessage: removal.isError
        ? t('activity.deleteFailed')
        : t('activity.deleteMessage', { name: activity?.title ?? '' }),
      contentInset,
    },
    effects: { askDelete, confirmDelete, cancelDelete, retry },
  };
}
