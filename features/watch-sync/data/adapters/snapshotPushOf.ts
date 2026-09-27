import type { Routine } from '@/features/routines';
import { encodeWatchRoutines, type WatchSnapshotPush } from '@/features/watch-bridge';
import { buildWatchRoutines } from '@/features/watch-sync/data/adapters/buildWatchRoutines';
import type { SnapshotPush } from '@/features/watch-sync/domain/entities/SnapshotPush';
import { contentKey } from '@/features/watch-sync/domain/utils/contentKey';

/**
 * The push the native side takes: the `kinetiq.watch-routines` document as JSON, keyed by its
 * content without the timestamp, so a push the watch already has is dropped. Throws when the
 * document breaks the watch's bounds, which the builder's clamping makes a bug, not data.
 */
export function snapshotPushOf(push: SnapshotPush<Routine>): WatchSnapshotPush {
  const document = buildWatchRoutines(push.routines, push.unitSystem, push.at);
  const { exportedAt: _exportedAt, ...content } = document;
  return {
    id: `snap-${push.at.getTime().toString(36)}`,
    payload: encodeWatchRoutines(document),
    contentKey: contentKey(JSON.stringify(content)),
    force: push.force,
    requestId: push.requestId,
  };
}
