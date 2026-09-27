import { useCallback, useMemo } from 'react';
import type { MetaItem } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { agoLabel, formatWeight, shortDateLabel, type UnitSystem } from '@/features/core/utils';
import type { ExercisePerformance } from '@/features/workouts/domain/entities/ExerciseHistory';

/** One past session's labels: the top set, the date and sets done, and the estimate or the age. */
export function useExerciseHistoryRowLogic(
  session: ExercisePerformance,
  units: UnitSystem,
  onOpen: (activityId: string) => void,
) {
  const { t } = useT();
  const load =
    session.topWeightKg > 0
      ? `${formatWeight(session.topWeightKg, units)} × ${session.topReps}`
      : t('exerciseDetail.bodyweightTimes', { reps: session.topReps });
  const meta = useMemo<MetaItem[]>(
    () => [
      { icon: 'calendar', label: shortDateLabel(session.performedAt) },
      {
        icon: 'layers',
        label:
          session.completedSets === session.sets
            ? t('workout.set', { count: session.completedSets })
            : t('details.setsOfTotal', { done: session.completedSets, total: session.sets }),
      },
    ],
    [session.completedSets, session.performedAt, session.sets, t],
  );
  const open = useCallback(() => onOpen(session.activityId), [onOpen, session.activityId]);

  return {
    derived: {
      load,
      meta,
      estimate:
        session.estimated1rmKg === null
          ? null
          : t('exerciseDetail.estSuffix', { value: formatWeight(session.estimated1rmKg, units) }),
      ago: agoLabel(session.performedAt),
    },
    effects: { open },
  };
}
