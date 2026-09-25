/**
 * iOS: the `WatchBridge` native module. Optional, so a build without it (Expo Go, a test)
 * gets the same no-op the Android file exports rather than a crash at import.
 */
import { requireOptionalNativeModule, type NativeModule } from 'expo';
import type { WatchBridge, WatchInboxEntry } from './types';

type Events = {
  onInboxChanged: () => void;
  onSnapshotRequested: (event: { requestId: string }) => void;
};

declare class WatchBridgeNative extends NativeModule<Events> {
  isSupported(): boolean;
  pushSnapshot(
    id: string,
    payload: string,
    contentKey: string,
    force: boolean,
    requestId: string | null,
  ): void;
  listInbox(): Promise<WatchInboxEntry[]>;
  ackInbox(id: string): Promise<void>;
  rejectInbox(id: string): Promise<void>;
}

const native = requireOptionalNativeModule<WatchBridgeNative>('WatchBridge');
const none = { remove: () => {} };

export const watchBridge: WatchBridge = {
  isSupported: () => native?.isSupported() ?? false,
  pushSnapshot: (id, payload, contentKey, force, requestId) =>
    native?.pushSnapshot(id, payload, contentKey, force, requestId),
  listInbox: async () => (native ? native.listInbox() : []),
  ackInbox: async (id) => native?.ackInbox(id),
  rejectInbox: async (id) => native?.rejectInbox(id),
  addInboxListener: (listener) => native?.addListener('onInboxChanged', listener) ?? none,
  addSnapshotRequestListener: (listener) =>
    native?.addListener('onSnapshotRequested', (event) => listener(event.requestId)) ?? none,
};
