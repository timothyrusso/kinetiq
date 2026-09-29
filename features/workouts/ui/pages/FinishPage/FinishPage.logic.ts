import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { haptics } from '@/features/core/haptics';
import { routes } from '@/features/core/navigation';
import { useT } from '@/features/core/translations';
import { routineUpdateOf } from '@/features/workouts/domain/utils/routineUpdate';
import { useActiveSession } from '@/features/workouts/facades/useActiveSession';
import { useFinishSession } from '@/features/workouts/facades/useFinishSession';
import { useSessionProgress } from '@/features/workouts/hooks/useSessionProgress';

/**
 * Finishing the workout in progress, as a form sheet: the confirmation, and for a workout from a
 * routine the switch "Update routine with today's values", on each time the sheet opens. The
 * routine changes only on Finish with the switch on; a swipe down, a discard or a killed app
 * change nothing. A workout not from a routine has no switch, and finishes with it off.
 */
export function useFinishPageLogic() {
  const { t } = useT();
  const { session } = useActiveSession();
  const progress = useSessionProgress(session);
  const finishSession = useFinishSession();
  const [updateRoutine, setUpdateRoutine] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canUpdateRoutine = session !== null && routineUpdateOf(session) !== null;
  const setWord = t('session.setWord', { count: progress.planned });

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
      message:
        progress.ratio < 1
          ? t('session.finishPartial', {
              left: progress.planned - progress.completed,
              planned: progress.planned,
              word: setWord,
            })
          : t('session.finishAll', { planned: progress.planned }),
    },
    effects: { finish, setUpdateRoutine },
  };
}
