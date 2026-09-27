import { useMemo } from 'react';
import type { MetaItem } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { formatTimer } from '@/features/core/utils';
import { useActiveSession } from '@/features/workouts';

/**
 * The resume card's view of the live session: the only reader of the session on this tab, so the
 * once-a-second tick re-renders this card and nothing above it.
 */
export function useLiveResumeCardLogic() {
  const { t } = useT();
  const { session } = useActiveSession();
  const card = useMemo(() => {
    if (session === null || (session.status !== 'active' && session.status !== 'paused')) return null;
    let completed = 0;
    let total = 0;
    for (const entry of session.entries) {
      total += entry.sets.length;
      for (const set of entry.sets) if (set.completed) completed += 1;
    }
    const progress = total > 0 ? completed / total : 0;
    const meta: MetaItem[] = [
      { icon: 'timer', label: formatTimer(session.elapsedSeconds) },
      { icon: 'checkCircle', label: t('workoutTab.setsOfTotal', { done: completed, total }) },
    ];
    return {
      name: session.routineName,
      paused: session.status === 'paused',
      meta,
      progress,
      progressLabel: `${Math.round(progress * 100)}%`,
      accessibilityLabel: t('workoutTab.resumeA11y', { name: session.routineName, done: completed, total }),
    };
  }, [session, t]);
  return { derived: { card } };
}
