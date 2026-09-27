import type { FeatureTier } from '@timothyrusso/arch-rules';

/** @public Read by the architecture rules, which build the tier graph from it. */
export const FEATURE_TIER: FeatureTier = 1;

export { encodeWatchRoutines } from '@/features/watch-bridge/data/adapters/encodeWatchRoutines';
export { readWatchWorkout } from '@/features/watch-bridge/data/adapters/readWatchWorkout';
export { WatchBridgeLive } from '@/features/watch-bridge/di/layer';
export { IMPORT_LIMITS, ITEM_BOUNDS } from '@/features/watch-bridge/domain/entities/WatchBounds';
export {
  WATCH_FORMAT_VERSION,
  WATCH_ROUTINES_FORMAT,
} from '@/features/watch-bridge/domain/entities/WatchFormat';
export type { WatchInboxEntry } from '@/features/watch-bridge/domain/schemas/WatchInboxEntrySchema';
export type { WatchRoutinesDocument } from '@/features/watch-bridge/domain/schemas/WatchRoutinesDocumentSchema';
export type { WatchWorkoutDocument } from '@/features/watch-bridge/domain/schemas/WatchWorkoutDocumentSchema';
/** The phone side of WatchConnectivity, for the tier-4 watch sync. */
export { WatchBridge, type WatchSnapshotPush } from '@/features/watch-bridge/domain/services/WatchBridge';
