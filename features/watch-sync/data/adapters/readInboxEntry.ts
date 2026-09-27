import { readWatchWorkout, type WatchInboxEntry } from '@/features/watch-bridge';
import { toCompletedWorkout } from '@/features/watch-sync/data/adapters/toCompletedWorkout';
import type { InboxItem } from '@/features/watch-sync/domain/entities/InboxItem';
import type { CompletedWorkout } from '@/features/workouts';

/**
 * An inbox entry as the drain reads it. The document is checked by its Schema (format, version,
 * size, types and the bounds the routine editor enforces); one that fails is never partly saved.
 */
export function readInboxEntry(entry: WatchInboxEntry): InboxItem<CompletedWorkout> {
  const read = readWatchWorkout(entry);
  return { id: entry.id, read: read.ok ? { ok: true, workout: toCompletedWorkout(read.document) } : read };
}
