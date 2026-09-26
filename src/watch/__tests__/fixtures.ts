import type { WatchInboxEntry } from '../../../modules/watch-bridge';
import type { WatchWorkoutDocument } from '../format';

export const UUID = '7A1D0C3E-1111-4222-8333-944455556666';

/** A valid document; overrides may break it on purpose, but only under the format's own keys. */
export function document(
  overrides: Partial<Record<keyof WatchWorkoutDocument, unknown>> = {},
): Record<string, unknown> {
  const valid: WatchWorkoutDocument = {
    format: 'kinetiq.watch-workout',
    version: 1,
    id: UUID,
    routineId: 'rtn_1',
    title: 'Push',
    startedAt: '2026-09-25T10:00:00.000Z',
    endedAt: '2026-09-25T10:45:00.000Z',
    notes: null,
    entries: [
      {
        exerciseId: 'wger:73',
        exerciseName: 'Bench Press',
        restSeconds: 120,
        notes: null,
        sets: [
          { index: 0, reps: 5, weightKg: 80, completed: true, rpe: null },
          { index: 1, reps: 5, weightKg: 80, completed: false, rpe: null },
        ],
      },
    ],
  };
  return { ...valid, ...overrides };
}

export function entry(doc: unknown = document(), overrides: Partial<WatchInboxEntry> = {}): WatchInboxEntry {
  return {
    id: UUID,
    format: 'kinetiq.watch-workout',
    version: 1,
    payload: typeof doc === 'string' ? doc : JSON.stringify(doc),
    ...overrides,
  };
}
