import { Effect } from 'effect';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

/**
 * Keeps the records a workout set, each only where it beats the stored best. Runs inside the
 * caller's transaction, so the records land or roll back with the workout.
 */
export const recordPersonalRecords = (records: readonly PersonalRecord[]) =>
  Effect.flatMap(RecordRepository, repository => repository.upsertBests(records));
