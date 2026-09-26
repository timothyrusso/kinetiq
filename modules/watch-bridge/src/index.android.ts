/** Android: there is no Wear OS app (issue #27), so the bridge is inert. */
import type { WatchBridge } from './types';

const none = { remove: () => {} };

export const watchBridge: WatchBridge = {
  isSupported: () => false,
  pushSnapshot: () => {},
  listInbox: async () => [],
  ackInbox: async () => {},
  rejectInbox: async () => {},
  addInboxListener: () => none,
  addSnapshotRequestListener: () => none,
};
