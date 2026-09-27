import { Context, type PubSub } from 'effect';
import type { RoutineChanged } from '@/features/routines/domain/entities/RoutineChanged';

/**
 * Where `RoutineRepository` announces its writes. A subscriber (the watch sync) reads the changes
 * from its own subscription, so a slow or failing listener can never fail or delay a save.
 */
export class RoutineEvents extends Context.Tag('routines/RoutineEvents')<
  RoutineEvents,
  PubSub.PubSub<RoutineChanged>
>() {}
