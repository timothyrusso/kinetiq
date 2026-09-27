import { Effect, Either } from 'effect';
import { itEffect } from '@/features/core/testing';
import { makeWatchBridgeDeviceLive } from '@/features/watch-bridge/data/services/watchBridgeDeviceLive';
import { WatchBridgeDeviceLive as AndroidLive } from '@/features/watch-bridge/data/services/watchBridgeDeviceLive.android';
import { WatchBridge } from '@/features/watch-bridge/domain/services/WatchBridge';
import type { WatchBridgeNative } from '@/features/watch-bridge/libraries/watchBridgeNative';

const inboxEntry = { id: 'e1', format: 'kinetiq.watch-workout', version: 1, payload: '{}' };

/** A native module that answers `listInbox` with `inbox` and records what it was asked. */
const makeNativeFake = (inbox: unknown) => {
  const calls: string[] = [];
  const native = {
    isSupported: () => true,
    pushSnapshot: (id: string) => void calls.push(`push ${id}`),
    listInbox: async () => inbox,
    ackInbox: async (id: string) => void calls.push(`ack ${id}`),
    rejectInbox: async (id: string) => void calls.push(`reject ${id}`),
    addListener: () => ({ remove: () => undefined }),
  } as unknown as WatchBridgeNative;
  return { native, calls };
};

const tagOf = <A, E extends { readonly _tag: string }>(effect: Effect.Effect<A, E>) =>
  Effect.map(Effect.either(effect), result => (Either.isLeft(result) ? result.left._tag : 'ok'));

describe('WatchBridgeDeviceLive', () => {
  const fake = makeNativeFake([inboxEntry]);
  itEffect(
    'decodes the native inbox and passes calls through',
    Effect.gen(function* () {
      const bridge = yield* WatchBridge;
      expect(yield* bridge.isSupported).toBe(true);
      expect(yield* bridge.listInbox).toEqual([inboxEntry]);
      yield* bridge.pushSnapshot({ id: 's1', payload: '{}', contentKey: 'k', force: false, requestId: null });
      yield* bridge.ackInbox('e1');
      yield* bridge.rejectInbox('e2');
      expect(fake.calls).toEqual(['push s1', 'ack e1', 'reject e2']);
    }),
    makeWatchBridgeDeviceLive(fake.native),
  );

  itEffect(
    'fails with a DecodeError when the native inbox is not a list of entries',
    Effect.gen(function* () {
      expect(yield* tagOf((yield* WatchBridge).listInbox)).toBe('DecodeError');
    }),
    makeWatchBridgeDeviceLive(makeNativeFake([{ id: 'e1' }]).native),
  );

  itEffect(
    'is unsupported without the native module, and every call fails with WatchUnavailable',
    Effect.gen(function* () {
      const bridge = yield* WatchBridge;
      expect(yield* bridge.isSupported).toBe(false);
      expect(yield* tagOf(bridge.listInbox)).toBe('WatchUnavailable');
      expect(yield* tagOf(bridge.ackInbox('e1'))).toBe('WatchUnavailable');
      expect(yield* tagOf(bridge.onInboxChanged(() => undefined))).toBe('WatchUnavailable');
    }),
    makeWatchBridgeDeviceLive(null),
  );

  itEffect(
    'on Android is unsupported and fails every call with WatchUnavailable',
    Effect.gen(function* () {
      const bridge = yield* WatchBridge;
      expect(yield* bridge.isSupported).toBe(false);
      expect(yield* tagOf(bridge.listInbox)).toBe('WatchUnavailable');
      expect(
        yield* tagOf(bridge.pushSnapshot({ id: 's1', payload: '{}', contentKey: 'k', force: true, requestId: 'r' })),
      ).toBe('WatchUnavailable');
      expect(yield* tagOf(bridge.onSnapshotRequested(() => undefined))).toBe('WatchUnavailable');
    }),
    AndroidLive,
  );
});
