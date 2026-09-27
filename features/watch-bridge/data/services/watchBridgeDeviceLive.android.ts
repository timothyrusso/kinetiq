import { Effect, Layer } from 'effect';
import { WatchUnavailable } from '@/features/watch-bridge/domain/errors/WatchBridgeErrors';
import { WatchBridge } from '@/features/watch-bridge/domain/services/WatchBridge';

const unavailable = Effect.fail(new WatchUnavailable());

/** Android: there is no Wear OS app, so the bridge is unsupported and every call fails with `WatchUnavailable`. */
export const WatchBridgeDeviceLive = Layer.succeed(WatchBridge, {
  isSupported: Effect.succeed(false),
  pushSnapshot: () => unavailable,
  listInbox: unavailable,
  ackInbox: () => unavailable,
  rejectInbox: () => unavailable,
  onInboxChanged: () => unavailable,
  onSnapshotRequested: () => unavailable,
});
