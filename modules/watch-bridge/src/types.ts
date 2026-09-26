/** A finished watch workout as the native inbox holds it, before JS has read the payload. */
export type WatchInboxEntry = {
  id: string;
  format: string;
  version: number;
  /** The document as JSON text. Empty when the file on disk could not be read. */
  payload: string;
};

type Subscription = { remove: () => void };

/**
 * The phone side of WatchConnectivity (issue #27). The same shape on every platform, so callers
 * never branch: on Android, and on an iPhone with no paired watch, it does nothing.
 */
export type WatchBridge = {
  isSupported: () => boolean;
  /**
   * Queues the routine snapshot for the watch unless a document with the same `contentKey` is
   * already there or on its way.
   * `force` sends it anyway; `requestId` answers a watch that asked for it.
   */
  pushSnapshot: (
    id: string,
    payload: string,
    contentKey: string,
    force: boolean,
    requestId: string | null,
  ) => void;
  listInbox: () => Promise<WatchInboxEntry[]>;
  /** The entry is committed: delete it. */
  ackInbox: (id: string) => Promise<void>;
  /** The entry can never be read: move it out of the retry loop, never delete it. */
  rejectInbox: (id: string) => Promise<void>;
  addInboxListener: (listener: () => void) => Subscription;
  addSnapshotRequestListener: (listener: (requestId: string) => void) => Subscription;
};
