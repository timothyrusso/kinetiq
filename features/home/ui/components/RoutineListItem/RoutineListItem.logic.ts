import { useCallback, useMemo } from 'react';
import type { MetaItem } from '@/features/core/design-system';
import type { TKey, TVars } from '@/features/core/translations';
import { formatAgoLocalized } from '@/features/core/utils';
import type { Routine } from '@/features/routines';

/**
 * One routine row's facts: exercise count, times completed, last performed. The count stays
 * first: the row's spoken label is "<name>. <items joined>", so it is the first fact VoiceOver
 * reads after the name.
 */
export function useRoutineListItemLogic(
  routine: Routine,
  t: (key: TKey, vars?: TVars) => string,
  locale: string,
  onOpen: (id: string) => void,
) {
  const meta = useMemo(() => {
    const items: MetaItem[] = [{ icon: 'layers', label: t('workout.exercise', { count: routine.items.length }) }];
    if (routine.timesCompleted > 0) {
      items.push({ icon: 'checkCircle', label: t('workoutTab.doneTimes', { count: routine.timesCompleted }) });
    }
    if (routine.lastPerformedAt !== null) {
      items.push({ icon: 'calendar', label: formatAgoLocalized(routine.lastPerformedAt, t, locale) });
    }
    return items;
  }, [locale, routine.items.length, routine.lastPerformedAt, routine.timesCompleted, t]);
  const press = useCallback(() => onOpen(routine.id), [onOpen, routine.id]);
  return { derived: { meta }, effects: { press } };
}
