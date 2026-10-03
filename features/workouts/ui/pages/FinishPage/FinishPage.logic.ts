import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { haptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { type TKey, type TVars, useT } from '@/features/core/translations';
import { routineUpdateOf } from '@/features/workouts/domain/utils/routineUpdate';
import { useActiveSession } from '@/features/workouts/facades/useActiveSession';
import { useFinishSession } from '@/features/workouts/facades/useFinishSession';
import { useSessionProgress } from '@/features/workouts/hooks/useSessionProgress';

type Translate = (key: TKey, vars?: TVars) => string;

/** What finishing records: nothing but the time with no exercises, else the sets left un-ticked. */
function finishMessage(entryCount: number, progress: { completed: number; planned: number }, t: Translate): string {
  if (entryCount === 0) return t('session.finishEmpty');
  const { completed, planned } = progress;
  if (completed >= planned) return t('session.finishAll', { planned });
  const word = t('session.setWord', { count: planned });
  return t('session.finishPartial', { left: planned - completed, planned, word });
}

/**
 * Finishing the workout in progress, as a form sheet: the confirmation, and for a workout from a
 * routine the switch "Update routine with today's values", on each time the sheet opens. The
 * routine changes only on Finish with the switch on; a swipe down, a discard or a killed app
 * change nothing. A workout not from a routine has no switch, and finishes with it off; so does
 * one left with no exercises, which finishes like an empty workout, with its time only.
 */
export function useFinishPageLogic() {
  const { t } = useT();
  const { session } = useActiveSession();
  const progress = useSessionProgress(session);
  const finishSession = useFinishSession();
  const [updateRoutine, setUpdateRoutine] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canUpdateRoutine = session !== null && routineUpdateOf(session) !== null;

  const { mutate, isPending } = finishSession;
  const finish = useCallback(() => {
    if (session === null || isPending) return;
    setError(null);
    mutate(
      { id: session.id, routineId: session.routineId, updateRoutine: canUpdateRoutine && updateRoutine },
      {
        onSuccess: result => {
          // NOTE: one signature per finish: a record's sheet plays its own, and two designed
          // patterns a moment apart blur into one long buzz.
          if (result.personalRecords.length === 0) {
            if (result.closedWeeklyGoal) haptics.weeklyGoalReached();
            else haptics.workoutFinished();
          }
          // NOTE: the workout now tops the history on Home, so that is where this goes, closing the
          // sheet and the live workout under it; a record is then presented over Home as a sheet.
          router.dismissTo(routes.home());
          if (result.personalRecords.length > 0) router.push(routes.sessionRecords(result.personalRecords));
        },
        onError: failure => {
          // NOTE: a workout already in history, or one gone, wrote nothing this time: saying it was
          // kept would send someone to a history that does not contain the workout they just did.
          const gone = failure._tag === 'DuplicateWorkout' || failure._tag === 'NoActiveSession';
          setError(t(gone ? 'session.saveFailed' : 'session.saveFailedKept'));
        },
      },
    );
  }, [canUpdateRoutine, isPending, mutate, session, t, updateRoutine]);

  return {
    state: { session, updateRoutine: canUpdateRoutine && updateRoutine, finishing: isPending, error },
    derived: {
      showRoutineSwitch: canUpdateRoutine,
      message: finishMessage(session?.entries.length ?? 0, progress, t),
    },
    effects: { finish, setUpdateRoutine },
  };
}
