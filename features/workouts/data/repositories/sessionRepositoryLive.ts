import { Clock, Effect, Layer } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { decodeRows } from '@/features/workouts/data/adapters/decodeRows';
import {
  SESSION_SELECT,
  SessionRow,
  sessionFromRow,
  sessionToRow,
} from '@/features/workouts/data/adapters/sessionRows';
import { SessionRepository } from '@/features/workouts/domain/repositories/SessionRepository';

const decodeSessions = decodeRows(SessionRow, 'sessions');

const UPSERT_SESSION = `INSERT INTO sessions (id, routine_id, routine_name, started_at, elapsed_seconds,
                             status, entries_json, active_index, rest_ends_at,
                             rest_duration, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         routine_id = excluded.routine_id,
         routine_name = excluded.routine_name,
         started_at = excluded.started_at,
         elapsed_seconds = excluded.elapsed_seconds,
         status = excluded.status,
         entries_json = excluded.entries_json,
         active_index = excluded.active_index,
         rest_ends_at = excluded.rest_ends_at,
         rest_duration = excluded.rest_duration,
         notes = excluded.notes,
         updated_at = excluded.updated_at`;

/**
 * The workout in progress in the app database's `sessions` table. A targeted update stamps
 * `updated_at` with the time it runs.
 */
export const SessionRepositoryLive = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    const first = (sql: string, params: string[] = []) =>
      trySql('read a session', () => db.getAllAsync<unknown>(sql, params)).pipe(
        Effect.flatMap(decodeSessions),
        Effect.map(([row]) => (row === undefined ? undefined : sessionFromRow(row))),
      );
    return {
      save: session =>
        trySql('save the session', () => db.runAsync(UPSERT_SESSION, sessionToRow(session))).pipe(Effect.asVoid),

      byId: id => first(`${SESSION_SELECT} WHERE id = ?`, [id]),

      active: first(`${SESSION_SELECT} WHERE status IN ('active', 'paused') ORDER BY updated_at DESC LIMIT 1`),

      clearRest: id =>
        Effect.flatMap(Clock.currentTimeMillis, now =>
          trySql('clear the rest', () =>
            db.runAsync('UPDATE sessions SET rest_ends_at = ?, rest_duration = ?, updated_at = ? WHERE id = ?', [
              null,
              null,
              now,
              id,
            ]),
          ),
        ).pipe(Effect.asVoid),

      setStatus: (id, status) =>
        Effect.flatMap(Clock.currentTimeMillis, now =>
          trySql('set the session status', () =>
            db.runAsync('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]),
          ),
        ).pipe(Effect.asVoid),

      remove: id =>
        trySql('discard the session', () => db.runAsync('DELETE FROM sessions WHERE id = ?', [id])).pipe(Effect.asVoid),
    };
  }),
);
