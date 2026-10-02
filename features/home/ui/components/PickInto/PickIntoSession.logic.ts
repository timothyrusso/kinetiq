import { useCallback, useMemo, useState } from 'react';
import { haptics } from '@/features/core/haptics';
import { type TKey, useT } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises';
import type { PickDestination } from '@/features/exercises/pages';
import { defaultItemTarget } from '@/features/routines';
import { useSettings } from '@/features/settings';
import { useActiveSession, useAddSessionExercise, useRemoveSessionExercise } from '@/features/workouts';

const DESTINATION: PickDestination = 'workout';

type RemovalKind = ReturnType<ReturnType<typeof useRemoveSessionExercise>['removalOf']>;

/** Why an exercise stays in the workout on a second tap, by the removal's kind; `null` removes. */
const LOCKED_KEY: Record<RemovalKind, TKey | null> = {
  removable: null,
  absent: null,
  hasCompletedSet: 'session.pickHasCompletedSet',
  lastExercise: 'session.pickLastExercise',
};

/**
 * Picks into the workout in progress. The opening targets are the routines' own, so an exercise
 * added mid-workout starts out like one added to a routine: the rest is the user's default. A
 * second tap takes an exercise back out, like the routine picker, but only one with nothing
 * logged and never the workout's last: the picker asks no confirmation, so it cannot drop sets.
 * Any other included row stays inert and says why.
 */
export function usePickIntoSessionLogic() {
  const { t } = useT();
  const defaultRest = useSettings(settings => settings.defaultRestSeconds);
  const { session } = useActiveSession();
  const { add } = useAddSessionExercise();
  const { removalOf, remove } = useRemoveSessionExercise();
  const [error, setError] = useState<string | null>(null);
  const entries = session?.entries;
  const ids = useMemo(() => (entries ?? []).map(entry => entry.exerciseId), [entries]);
  const isIncluded = useCallback((exerciseId: string) => ids.includes(exerciseId), [ids]);
  const lockedReason = useCallback(
    (exerciseId: string) => {
      const key = LOCKED_KEY[removalOf(exerciseId)];
      return key === null ? null : t(key);
    },
    [removalOf, t],
  );
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
  const unpick = useCallback(
    (exerciseId: string) => {
      setError(null);
      if (remove(exerciseId)) haptics.light();
    },
    [remove],
  );
  return { state: { error, destination: DESTINATION }, effects: { pick, unpick, isIncluded, lockedReason } };
}
