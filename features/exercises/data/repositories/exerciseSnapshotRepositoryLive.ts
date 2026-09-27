import { Effect, Layer } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { decodeRows } from '@/features/exercises/data/adapters/catalogRows';
import { SnapshotRow, snapshotFromRow } from '@/features/exercises/data/adapters/snapshotRows';
import { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';

const decodeSnapshots = decodeRows(SnapshotRow, 'exercises');

/** The stored snapshots in the app database's `exercises` table. */
export const ExerciseSnapshotRepositoryLive = Layer.effect(
  ExerciseSnapshotRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      byId: exerciseId =>
        trySql('read a stored exercise', () =>
          db.getAllAsync<unknown>('SELECT * FROM exercises WHERE id = ?', [exerciseId]),
        ).pipe(
          Effect.flatMap(decodeSnapshots),
          Effect.map(([row]) => (row === undefined ? undefined : snapshotFromRow(row))),
        ),
    };
  }),
);
