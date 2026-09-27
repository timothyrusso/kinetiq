import type { WatchBridgeNative } from '@/features/watch-bridge/libraries/watchBridgeNative';

/** Android: there is no Wear OS app, so there is no native module. */
export const watchBridgeNative: WatchBridgeNative | null = null;
