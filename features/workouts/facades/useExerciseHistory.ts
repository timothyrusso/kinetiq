import { useEffectQuery } from '@/features/core/query';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';
import { EMPTY_EXERCISE_HISTORY } from '@/features/workouts/domain/utils/exerciseHistory';
import { workoutQueryKeys } from '@/features/workouts/facades/workoutQueryKeys';
import { exerciseHistory, exerciseRecords } from '@/features/workouts/useCases/exerciseHistory';

/** Only a finished workout changes these, and it invalidates; the minute is for tab switches. */
const HISTORY_STALE_TIME_MS = 60_000;

const EMPTY_RECORDS: readonly PersonalRecord[] = [];

/**
 * Everything the user has done with `exerciseId`, and the records held for it: two reads, since
 * the log and the records table are different claims. Nothing is read without an id.
 */
export function useExerciseHistory(exerciseId: string | null) {
  const history = useEffectQuery({
    queryKey: workoutQueryKeys.exerciseHistory(exerciseId ?? 'none'),
    queryFn: exerciseHistory(exerciseId ?? 'none'),
    enabled: exerciseId !== null,
    staleTime: HISTORY_STALE_TIME_MS,
  });
  const records = useEffectQuery({
    queryKey: workoutQueryKeys.exerciseRecords(exerciseId ?? 'none'),
    queryFn: exerciseRecords(exerciseId ?? 'none'),
    enabled: exerciseId !== null,
    staleTime: HISTORY_STALE_TIME_MS,
  });
  return {
    history: history.data ?? EMPTY_EXERCISE_HISTORY,
    records: records.data ?? EMPTY_RECORDS,
    isLoading: history.isLoading || records.isLoading,
    error: history.error ?? records.error,
    refresh: history.refetch,
  };
}
