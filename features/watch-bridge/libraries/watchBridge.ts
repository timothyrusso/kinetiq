import type { WatchInboxEntry } from '@/features/watch-bridge/domain/schemas/WatchInboxEntrySchema';
import { watchBridgeNative as native } from '@/features/watch-bridge/libraries/watchBridgeNative';

interface Subscription {
  readonly remove: () => void;
}

/** The bridge as plain calls. */
interface LegacyWatchBridge {
  readonly isSupported: () => boolean;
  /**
   * Queues the routine snapshot for the watch unless a document with the same `contentKey` is
   * already there or on its way. `force` sends it anyway; `requestId` answers a watch that asked.
   */
  readonly pushSnapshot: (
    id: string,
    payload: string,
    contentKey: string,
    force: boolean,
    requestId: string | null,
  ) => void;
  readonly listInbox: () => Promise<WatchInboxEntry[]>;
  /** The entry is committed: delete it. */
  readonly ackInbox: (id: string) => Promise<void>;
  /** The entry can never be read: move it out of the retry loop, never delete it. */
  readonly rejectInbox: (id: string) => Promise<void>;
  readonly addInboxListener: (listener: () => void) => Subscription;
  readonly addSnapshotRequestListener: (listener: (requestId: string) => void) => Subscription;
}

const none: Subscription = { remove: () => {} };

/**
 * The bridge as plain calls, for the legacy watch sync until it runs through the `WatchBridge`
 * Tag (#54). The same shape on every platform, so callers never branch: without the native module
 * (Android, an iPhone build without it) it does nothing.
 */
export const watchBridge: LegacyWatchBridge = {
  isSupported: () => native?.isSupported() ?? false,
  pushSnapshot: (id, payload, contentKey, force, requestId) =>
    native?.pushSnapshot(id, payload, contentKey, force, requestId),
  listInbox: async () => (native ? native.listInbox() : []),
  ackInbox: async id => native?.ackInbox(id),
  rejectInbox: async id => native?.rejectInbox(id),
  addInboxListener: listener => native?.addListener('onInboxChanged', listener) ?? none,
  addSnapshotRequestListener: listener =>
    native?.addListener('onSnapshotRequested', event => listener(event.requestId)) ?? none,
};
