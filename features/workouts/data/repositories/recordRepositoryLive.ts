import { Effect, Layer } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { decodeRows } from '@/features/workouts/data/adapters/decodeRows';
import { RecordRow, recordFromRow } from '@/features/workouts/data/adapters/recordRows';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

const decodeRecords = decodeRows(RecordRow, 'records');

/** Two values closer than this are the same record. */
const RECORD_TOLERANCE = 1e-6;

const SELECT_RECORD =
  'SELECT exercise_id, kind, exercise_name, value, achieved_at FROM records WHERE exercise_id = ? AND kind = ?';

const UPSERT_RECORD = `INSERT INTO records (exercise_id, kind, exercise_name, value, achieved_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(exercise_id, kind) DO UPDATE SET
       exercise_name = excluded.exercise_name,
       value = excluded.value,
       achieved_at = excluded.achieved_at`;

/** The personal records in the app database's `records` table. */
export const RecordRepositoryLive = Layer.effect(
  RecordRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;

    // NOTE: keeps `candidate` when it beats the stored best; an equal value only moves the date on.
    const upsertBest = (candidate: PersonalRecord) =>
      Effect.gen(function* () {
        const [existing] = yield* trySql('read a record', () =>
          db.getAllAsync<unknown>(SELECT_RECORD, [candidate.exerciseId, candidate.kind]),
        ).pipe(Effect.flatMap(decodeRecords));
        if (existing && existing.value > candidate.value + RECORD_TOLERANCE) return;
        if (existing && Math.abs(existing.value - candidate.value) < RECORD_TOLERANCE) {
          if (candidate.achievedAt <= existing.achieved_at) return;
          yield* trySql('re-date a record', () =>
            db.runAsync('UPDATE records SET achieved_at = ? WHERE exercise_id = ? AND kind = ?', [
              candidate.achievedAt,
              candidate.exerciseId,
              candidate.kind,
            ]),
          );
          return;
        }
        yield* trySql('write a record', () =>
          db.runAsync(UPSERT_RECORD, [
            candidate.exerciseId,
            candidate.kind,
            candidate.exerciseName,
            candidate.value,
            candidate.achievedAt,
          ]),
        );
      });

    return {
      forExercise: exerciseId =>
        trySql('read the records of an exercise', () =>
          db.getAllAsync<unknown>(
            `SELECT exercise_id, kind, exercise_name, value, achieved_at FROM records
       WHERE exercise_id = ? ORDER BY kind`,
            [exerciseId],
          ),
        ).pipe(
          Effect.flatMap(decodeRecords),
          Effect.map(rows => rows.map(recordFromRow)),
        ),

      upsertBests: records => Effect.forEach(records, upsertBest, { discard: true }),
    };
  }),
);
