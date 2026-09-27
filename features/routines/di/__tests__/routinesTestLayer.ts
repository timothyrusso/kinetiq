import { Layer } from 'effect';
import { ExercisesLive } from '@/features/exercises';
import { RoutinesLive } from '@/features/routines/di/layer';

/**
 * The routines with the exercises they store their snapshots in, both real: what a facade or
 * ViewModel test runs over, on `makeTestRuntime`'s migrated in-memory database.
 */
export const RoutinesTestLayer = Layer.merge(RoutinesLive, ExercisesLive);
