import { Layer } from 'effect';
import { RoutineRepositoryLive } from '@/features/routines/data/repositories/routineRepositoryLive';
import { RoutineEventsLive } from '@/features/routines/data/services/routineEventsLive';

/**
 * Every Layer `routines` provides: the repository, and the change events it publishes on, which
 * the repository and the subscribers share.
 */
export const RoutinesLive = RoutineRepositoryLive.pipe(Layer.provideMerge(RoutineEventsLive));
