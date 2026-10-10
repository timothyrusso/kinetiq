import type { WatchInboxEntry } from '@/features/watch-bridge/domain/schemas/WatchInboxEntrySchema';
import type { WatchWorkoutDocument } from '@/features/watch-bridge/domain/schemas/WatchWorkoutDocumentSchema';

/** A `kinetiq.watch-workout` document and its inbox entry, as the watch sends them. */
export const UUID = '7A1D0C3E-1111-4222-8333-944455556666';

/** A valid document; overrides may break it on purpose, but only under the format's own keys. */
export function document(
  overrides: Partial<Record<keyof WatchWorkoutDocument, unknown>> = {},
): Record<string, unknown> {
  const valid: WatchWorkoutDocument = {
    format: 'kinetiq.watch-workout',
    version: 3,
    id: UUID,
    routineId: 'rtn_1',
    title: 'Push',
    startedAt: '2026-09-25T10:00:00.000Z',
    endedAt: '2026-09-25T10:45:00.000Z',
    notes: null,
    entries: [
      {
        exerciseId: 'ex:barbell-bench-press',
        exerciseName: 'Bench Press',
        trackingType: 'weightReps',
        restSeconds: 120,
        notes: null,
        sets: [
          { type: 'weightReps', index: 0, reps: 5, weightKg: 80, completed: true, rpe: null },
          { type: 'weightReps', index: 1, reps: 5, weightKg: 80, completed: false, rpe: null },
        ],
      },
      {
        exerciseId: 'ex:pullups',
        exerciseName: 'Pull-up',
        trackingType: 'repsOnly',
        restSeconds: 90,
        notes: null,
        sets: [{ type: 'repsOnly', index: 0, reps: 10, completed: true, rpe: 8 }],
      },
      {
        exerciseId: 'ex:plank',
        exerciseName: 'Plank',
        trackingType: 'duration',
        restSeconds: 60,
        notes: null,
        sets: [{ type: 'duration', index: 0, durationSeconds: 45, completed: true, rpe: null }],
      },
    ],
  };
  return { ...valid, ...overrides };
}

export function entry(doc: unknown = document(), overrides: Partial<WatchInboxEntry> = {}): WatchInboxEntry {
  return {
    id: UUID,
    format: 'kinetiq.watch-workout',
    version: 3,
    payload: typeof doc === 'string' ? doc : JSON.stringify(doc),
    ...overrides,
  };
}
