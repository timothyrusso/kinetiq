import type { UnitSystem } from '@/features/core/utils';

/**
 * The routines to mirror on the watch, and how the push was asked for. Generic over the routine,
 * which `routines` owns: a domain type never names another feature's.
 */
export interface SnapshotPush<Routine> {
  readonly routines: readonly Routine[];
  readonly unitSystem: UnitSystem;
  readonly at: Date;
  /** Send it even when the watch already has the same content. */
  readonly force: boolean;
  /** Answers the watch request that asked for it. */
  readonly requestId: string | null;
}
