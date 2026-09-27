import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';

/** What happened to the routine. */
export type RoutineChangeKind = 'saved' | 'renamed' | 'deleted' | 'reordered' | 'itemsChanged' | 'used';

/**
 * The routines on disk changed. Published after every write, for code that mirrors the routines
 * elsewhere (the watch's copy): the repository announces its writes, and knows nothing about who
 * listens.
 */
export interface RoutineChanged {
  readonly routineId: RoutineId;
  readonly kind: RoutineChangeKind;
}
