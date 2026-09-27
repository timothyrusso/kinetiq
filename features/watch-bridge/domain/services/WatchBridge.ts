import { Context, type Effect } from 'effect';
import type { DecodeError, UnexpectedError } from '@/features/core/error';
import type { WatchUnavailable } from '@/features/watch-bridge/domain/errors/WatchBridgeErrors';
import type { WatchInboxEntry } from '@/features/watch-bridge/domain/schemas/WatchInboxEntrySchema';

/** The routine snapshot to hand the watch. */
export interface WatchSnapshotPush {
  readonly id: string;
  /** The `kinetiq.watch-routines` document as JSON. */
  readonly payload: string;
  /** The native side drops a push whose `contentKey` the watch already has or is receiving. */
  readonly contentKey: string;
  /** Send it even when the watch has the same content. */
  readonly force: boolean;
  /** Answers the watch request that asked for it. */
  readonly requestId: string | null;
}

/** Stops a listener. */
export interface WatchSubscription {
  readonly remove: () => void;
}

/**
 * The phone side of WatchConnectivity. Without a watch bridge (Android, a build without the
 * native module) `isSupported` is `false` and every other call fails with `WatchUnavailable`; a
 * native call that throws is an `UnexpectedError`.
 */
export class WatchBridge extends Context.Tag('watch-bridge/WatchBridge')<
  WatchBridge,
  {
    readonly isSupported: Effect.Effect<boolean>;
    readonly pushSnapshot: (push: WatchSnapshotPush) => Effect.Effect<void, WatchUnavailable | UnexpectedError>;
    /** The finished workouts waiting in the native inbox, oldest first. */
    readonly listInbox: Effect.Effect<readonly WatchInboxEntry[], WatchUnavailable | DecodeError | UnexpectedError>;
    /** The entry is committed: delete it. */
    readonly ackInbox: (id: string) => Effect.Effect<void, WatchUnavailable | UnexpectedError>;
    /** The entry can never be read: move it out of the retry loop, never delete it. */
    readonly rejectInbox: (id: string) => Effect.Effect<void, WatchUnavailable | UnexpectedError>;
    readonly onInboxChanged: (listener: () => void) => Effect.Effect<WatchSubscription, WatchUnavailable>;
    readonly onSnapshotRequested: (
      listener: (requestId: string) => void,
    ) => Effect.Effect<WatchSubscription, WatchUnavailable>;
  }
>() {}
