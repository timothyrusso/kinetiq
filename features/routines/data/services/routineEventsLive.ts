import { Layer, PubSub } from 'effect';
import type { RoutineChanged } from '@/features/routines/domain/entities/RoutineChanged';
import { RoutineEvents } from '@/features/routines/domain/services/RoutineEvents';

/**
 * The routine changes, as an unbounded `PubSub`: a publish never waits for a subscriber, so a save
 * never waits for the watch.
 */
export const RoutineEventsLive = Layer.effect(RoutineEvents, PubSub.unbounded<RoutineChanged>());
