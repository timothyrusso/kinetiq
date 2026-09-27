import { Effect, Layer } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { decodeRows } from '@/features/exercises/data/adapters/catalogRows';
import { SnapshotRow, snapshotFromRow, snapshotToRow } from '@/features/exercises/data/adapters/snapshotRows';
import { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';

const decodeSnapshots = decodeRows(SnapshotRow, 'exercises');

const UPSERT_SNAPSHOT = `INSERT INTO exercises (id, name, external_id, instructions, category,
                            primary_muscles, secondary_muscles, equipment,
                            image_url, thumbnail_url, source, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       external_id = excluded.external_id,
       instructions = excluded.instructions,
       category = excluded.category,
       primary_muscles = excluded.primary_muscles,
       secondary_muscles = excluded.secondary_muscles,
       equipment = excluded.equipment,
       image_url = COALESCE(excluded.image_url, exercises.image_url),
       thumbnail_url = COALESCE(excluded.thumbnail_url, exercises.thumbnail_url),
       captured_at = excluded.captured_at`;

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

      byIds: exerciseIds =>
        exerciseIds.length === 0
          ? Effect.succeed(new Map<string, ExerciseSnapshot>())
          : trySql('read stored exercises', () =>
              db.getAllAsync<unknown>(
                `SELECT * FROM exercises WHERE id IN (${exerciseIds.map(() => '?').join(', ')})`,
                [...exerciseIds],
              ),
            ).pipe(
              Effect.flatMap(decodeSnapshots),
              Effect.map(rows => new Map(rows.map(row => [row.id, snapshotFromRow(row)]))),
            ),

      byName: name =>
        trySql('find a stored exercise by name', () =>
          db.getAllAsync<unknown>(
            'SELECT * FROM exercises WHERE name = ? COLLATE NOCASE ORDER BY captured_at DESC LIMIT 1',
            [name.trim()],
          ),
        ).pipe(
          Effect.flatMap(decodeSnapshots),
          Effect.map(([row]) => (row === undefined ? undefined : snapshotFromRow(row))),
        ),

      upsert: snapshot =>
        trySql('store an exercise', () => db.runAsync(UPSERT_SNAPSHOT, snapshotToRow(snapshot))).pipe(Effect.asVoid),
    };
  }),
);
