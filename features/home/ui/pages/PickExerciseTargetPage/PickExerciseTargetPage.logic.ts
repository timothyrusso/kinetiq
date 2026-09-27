import { useLocalSearchParams } from 'expo-router';
import { RoutineId } from '@/features/routines';

/**
 * Which list the picker adds to. Three places put an exercise into a list, and each writes
 * through the store or query it already owns: the routine builder's draft store, a saved
 * routine's mutation, the live session's engine. The route says which with `target` (and `id`
 * for a saved routine), so the picker never receives a callback.
 */
export function usePickExerciseTargetPageLogic() {
  const { target, id } = useLocalSearchParams<{ target?: string; id?: string }>();
  const routineId = target === 'routine' && id ? RoutineId.make(id) : null;
  return { state: { routineId, intoSession: routineId === null && target === 'session' } };
}
