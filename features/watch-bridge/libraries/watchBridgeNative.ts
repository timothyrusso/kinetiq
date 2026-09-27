import { type NativeModule, requireOptionalNativeModule } from 'expo';
import type { WatchInboxEntry } from '@/features/watch-bridge/domain/schemas/WatchInboxEntrySchema';

type Events = {
  onInboxChanged: () => void;
  onSnapshotRequested: (event: { requestId: string }) => void;
};

/** The iOS `WatchBridge` native module in `modules/watch-bridge`. */
export declare class WatchBridgeNative extends NativeModule<Events> {
  isSupported(): boolean;
  pushSnapshot(id: string, payload: string, contentKey: string, force: boolean, requestId: string | null): void;
  /** As the native side reports it: the Live Layer decodes it before use. */
  listInbox(): Promise<WatchInboxEntry[]>;
  ackInbox(id: string): Promise<void>;
  rejectInbox(id: string): Promise<void>;
}

/**
 * The native module, or `null` in a build without it (Expo Go, a test): optional, so its absence
 * is the same inert bridge Android gets rather than a crash at import.
 */
export const watchBridgeNative = requireOptionalNativeModule<WatchBridgeNative>('WatchBridge');
