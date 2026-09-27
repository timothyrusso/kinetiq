import { Effect, Layer, Schema } from 'effect';
import { DecodeError, toAppError } from '@/features/core/error';
import { WatchUnavailable } from '@/features/watch-bridge/domain/errors/WatchBridgeErrors';
import { WatchInboxEntrySchema } from '@/features/watch-bridge/domain/schemas/WatchInboxEntrySchema';
import { WatchBridge } from '@/features/watch-bridge/domain/services/WatchBridge';
import { type WatchBridgeNative, watchBridgeNative } from '@/features/watch-bridge/libraries/watchBridgeNative';

const decodeInbox = Schema.decodeUnknown(Schema.Array(WatchInboxEntrySchema));

/** The bridge over `native`, or one that is unavailable when there is no native module. */
export const makeWatchBridgeDeviceLive = (native: WatchBridgeNative | null) =>
  Layer.succeed(WatchBridge, {
    isSupported: Effect.sync(() => native?.isSupported() ?? false),
    pushSnapshot: push =>
      native === null
        ? Effect.fail(new WatchUnavailable())
        : Effect.try({
            try: () => native.pushSnapshot(push.id, push.payload, push.contentKey, push.force, push.requestId),
            catch: cause => toAppError(cause),
          }),
    listInbox:
      native === null
        ? Effect.fail(new WatchUnavailable())
        : Effect.tryPromise({ try: () => native.listInbox(), catch: cause => toAppError(cause) }).pipe(
            Effect.flatMap(entries =>
              decodeInbox(entries).pipe(Effect.mapError(cause => new DecodeError({ source: 'watch inbox', cause }))),
            ),
          ),
    ackInbox: id =>
      native === null
        ? Effect.fail(new WatchUnavailable())
        : Effect.tryPromise({ try: () => native.ackInbox(id), catch: cause => toAppError(cause) }),
    rejectInbox: id =>
      native === null
        ? Effect.fail(new WatchUnavailable())
        : Effect.tryPromise({ try: () => native.rejectInbox(id), catch: cause => toAppError(cause) }),
    onInboxChanged: listener =>
      native === null
        ? Effect.fail(new WatchUnavailable())
        : Effect.sync(() => native.addListener('onInboxChanged', listener)),
    onSnapshotRequested: listener =>
      native === null
        ? Effect.fail(new WatchUnavailable())
        : Effect.sync(() => native.addListener('onSnapshotRequested', event => listener(event.requestId))),
  });

/** The iOS bridge over the `WatchBridge` native module. */
export const WatchBridgeDeviceLive = makeWatchBridgeDeviceLive(watchBridgeNative);
