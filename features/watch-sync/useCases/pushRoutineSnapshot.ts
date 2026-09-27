import { Clock, Effect } from 'effect';
import type { AppError } from '@/features/core/error';
import type { UnitSystem } from '@/features/core/utils';
import { type Routine, RoutineRepository } from '@/features/routines';
import type { SnapshotPush } from '@/features/watch-sync/domain/entities/SnapshotPush';

/** Hands a snapshot to the native side, which drops a push the watch already has. */
export type SendSnapshot = (push: SnapshotPush<Routine>) => Effect.Effect<void, AppError>;

/** Why a push happens: the watch's Sync button forces one and names its request. */
export interface SnapshotRequest {
  readonly force?: boolean;
  readonly requestId?: string | null;
}

/** Reads every routine now and sends them to the watch in `unitSystem`. */
export const pushRoutineSnapshot = (send: SendSnapshot, unitSystem: UnitSystem, request: SnapshotRequest = {}) =>
  Effect.gen(function* () {
    const routines = yield* (yield* RoutineRepository).list;
    const now = yield* Clock.currentTimeMillis;
    yield* send({
      routines,
      unitSystem,
      at: new Date(now),
      force: request.force ?? false,
      requestId: request.requestId ?? null,
    });
  });
