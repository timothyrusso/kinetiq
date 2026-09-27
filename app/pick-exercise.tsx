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

import type { Exercise } from '@/features/exercises';
import { PickExercisePage } from '@/features/exercises/pages';
import { useT } from '@/i18n/useT';
import {
  defaultItemTarget,
  RoutineId,
  useAddRoutineExercise,
  useRoutine,
  useRoutineDraft,
} from '@/features/routines';
import { haptics } from '@/services/haptics';
import { useSettings } from '@/features/settings';
import { useActiveSession, useAddSessionExercise } from '@/features/workouts';

type Target = 'draft' | 'routine' | 'session';

export default function PickExerciseSheet() {
  const { target, id } = useLocalSearchParams<{ target?: Target; id?: string }>();
  if (target === 'routine' && id) return <IntoRoutine routineId={RoutineId.make(id)} />;
  if (target === 'session') return <IntoSession />;
  return <IntoDraft />;
}

function IntoDraft() {
  // Subscribed so the included marks update as exercises are added.
  const { actions } = useRoutineDraft();
  const pick = useCallback(
    (exercise: Exercise) => {
      actions.addExercise(exercise);
      haptics.success();
    },
    [actions],
  );
  return <PickExercisePage isIncluded={actions.containsExercise} onPick={pick} error={null} />;
}

function IntoRoutine({ routineId }: { routineId: RoutineId }) {
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
  return <PickExercisePage isIncluded={isIncluded} onPick={pick} error={error} />;
}

function IntoSession() {
  const { t } = useT();
  const defaultRest = useSettings((s) => s.defaultRestSeconds);
  const { session } = useActiveSession();
  const { add } = useAddSessionExercise();
  const [error, setError] = useState<string | null>(null);
  const entries = session?.entries;
  const ids = useMemo(() => (entries ?? []).map((entry) => entry.exerciseId), [entries]);
  const isIncluded = useCallback((exerciseId: string) => ids.includes(exerciseId), [ids]);
  const pick = useCallback(
    (exercise: Exercise) => {
      setError(null);
      // The opening targets come from `defaultItemTarget`, the routines' own, so an exercise
      // added mid-workout starts out like one added to a routine: the rest is the user's default.
      add(exercise, defaultItemTarget(defaultRest), ids.includes(exercise.id))
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
    [add, defaultRest, ids, t],
  );
  return <PickExercisePage isIncluded={isIncluded} onPick={pick} error={error} />;
}
