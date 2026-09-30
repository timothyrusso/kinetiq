import { useCallback, useMemo, useState } from 'react';
import { haptics } from '@/features/core/haptics';
import { useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises';
import type { PickDestination } from '@/features/exercises/pages';
import { defaultItemTarget } from '@/features/routines';
import { useSettings } from '@/features/settings';
import { useActiveSession, useAddSessionExercise } from '@/features/workouts';

const DESTINATION: PickDestination = 'workout';

/**
 * Picks into the workout in progress. The opening targets are the routines' own, so an exercise
 * added mid-workout starts out like one added to a routine: the rest is the user's default.
 */
export function usePickIntoSessionLogic() {
  const { t } = useT();
  const defaultRest = useSettings(settings => settings.defaultRestSeconds);
  const { session } = useActiveSession();
  const { add } = useAddSessionExercise();
  const [error, setError] = useState<string | null>(null);
  const entries = session?.entries;
  const ids = useMemo(() => (entries ?? []).map(entry => entry.exerciseId), [entries]);
  const isIncluded = useCallback((exerciseId: string) => ids.includes(exerciseId), [ids]);
  const pick = useCallback(
    (exercise: Exercise) => {
      setError(null);
      add(exercise, defaultItemTarget(defaultRest), ids.includes(exercise.id))
        .then(added => {
          if (added) {
            haptics.success();
            return;
          }
          // NOTE: both reasons this returns false mean the list did not change: it was already in
          // the workout, or the workout finished while the sheet was open.
          setError(t('session.addNotChanged'));
          haptics.warning();
        })
        .catch(() => {
          setError(t('session.addFailed'));
          haptics.warning();
        });
    },
    [add, defaultRest, ids, t],
  );
  return { state: { error, destination: DESTINATION }, effects: { pick, isIncluded } };
}
