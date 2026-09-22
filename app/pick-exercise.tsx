/**
 * The exercise library picker, as a form sheet.
 *
 * Three places put an exercise into a list, and each writes through the store or query it
 * already owns: the routine builder's draft store, a saved routine's mutation, the live
 * session's engine. The route says which with `target` (and `id` for a saved routine), so the
 * picker never receives a callback and the screen underneath never parks a choice in a
 * mailbox for later.
 *
 * Each target is its own component because each calls different hooks; choosing between them
 * by param keeps every hook call unconditional.
 */
import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import type { Exercise } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { useAddRoutineExercise, useRoutine } from '@/queries/useRoutines';
import { defaultItemTarget } from '@/routines/draft';
import { addDraftExercise, containsExercise, useRoutineDraft } from '@/routines/draftStore';
import { haptics } from '@/services/haptics';
import { useSettings } from '@/settings';
import { ExercisePicker } from '@/ui/exercisePicker';
import { useWorkoutSession } from '@/workout/session';
import { addExerciseToSession } from '@/workout/sessionExercises';

type Target = 'draft' | 'routine' | 'session';

export default function PickExerciseSheet() {
  const { target, id } = useLocalSearchParams<{ target?: Target; id?: string }>();
  if (target === 'routine' && id) return <IntoRoutine routineId={id} />;
  if (target === 'session') return <IntoSession />;
  return <IntoDraft />;
}

function IntoDraft() {
  // Subscribed so the included marks update as exercises are added.
  useRoutineDraft();
  const pick = useCallback((exercise: Exercise) => {
    addDraftExercise(exercise);
    haptics.success();
  }, []);
  return <ExercisePicker isIncluded={containsExercise} onPick={pick} error={null} />;
}

function IntoRoutine({ routineId }: { routineId: string }) {
  const { t } = useT();
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { routine } = useRoutine(routineId);
  const addExercise = useAddRoutineExercise();
  const [error, setError] = useState<string | null>(null);
  const ids = useMemo(() => (routine?.items ?? []).map((item) => item.exerciseId), [routine]);
  const isIncluded = useCallback((exerciseId: string) => ids.includes(exerciseId), [ids]);
  const pick = useCallback(
    (exercise: Exercise) => {
      setError(null);
      // The opening targets come from `defaultItemTarget`, the same function the draft store
      // calls, so a row added here and a row added in the builder cannot start out different.
      addExercise
        .mutateAsync({ routineId, exercise, item: defaultItemTarget(defaultRest) })
        .then(() => haptics.success())
        .catch(() => {
          setError(t('routine.addFailed'));
          haptics.warning();
        });
    },
    [addExercise, defaultRest, routineId, t],
  );
  return <ExercisePicker isIncluded={isIncluded} onPick={pick} error={error} />;
}

function IntoSession() {
  const { t } = useT();
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { session } = useWorkoutSession();
  const [error, setError] = useState<string | null>(null);
  const ids = useMemo(() => (session?.entries ?? []).map((entry) => entry.exerciseId), [session]);
  const isIncluded = useCallback((exerciseId: string) => ids.includes(exerciseId), [ids]);
  const pick = useCallback(
    (exercise: Exercise) => {
      setError(null);
      addExerciseToSession({
        exercise,
        defaultRestSeconds: defaultRest,
        isDuplicate: ids.includes(exercise.id),
      })
        .then((added) => {
          if (added) {
            haptics.success();
            return;
          }
          // Both reasons this returns false mean the list did not change: it was already in
          // the workout, or the workout finished while the sheet was open.
          setError(t('session.addNotChanged'));
          haptics.warning();
        })
        .catch(() => {
          setError(t('session.addFailed'));
          haptics.warning();
        });
    },
    [defaultRest, ids, t],
  );
  return <ExercisePicker isIncluded={isIncluded} onPick={pick} error={error} />;
}
