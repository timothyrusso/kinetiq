/**
 * Active-workout session repository.
 *
 * Every mutation the user can make during a workout lands here, so a force-quit
 * loses at most the last keystroke. The rest timer is stored as an absolute
 * wall-clock deadline rather than a countdown, which is why a five-minute rest
 * that spanned a background still reads correctly on return.
 */
import { getDatabase } from './database';
import { rowToSession, stringify } from './codec';
import type { SessionRow } from './rows';
import type { StrengthEntry, WorkoutSession, WorkoutSessionStatus } from '@/domain/types';

const SELECT = `
  SELECT id, routine_id, routine_name, started_at, elapsed_seconds, status,
         entries_json, active_index, rest_ends_at, rest_duration, notes, updated_at
  FROM sessions`;

export const sessionRepository = {
  async save(session: WorkoutSession): Promise<void> {
    await getDatabase().runAsync(
      `INSERT INTO sessions (id, routine_id, routine_name, started_at, elapsed_seconds,
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
         updated_at = excluded.updated_at`,
      session.id,
      session.routineId,
      session.routineName,
      session.startedAt,
      session.elapsedSeconds,
      session.status,
      stringify(session.entries),
      session.activeIndex,
      session.restEndsAt,
      session.restDurationSeconds,
      session.notes,
      session.updatedAt,
    );
  },

  async byId(id: string): Promise<WorkoutSession | null> {
    const row = await getDatabase().getFirstAsync<SessionRow>(`${SELECT} WHERE id = ?`, id);
    return row ? rowToSession(row) : null;
  },

  /**
   * The session to offer restoring, if any. `finished`/`discarded` rows are kept
   * briefly for audit but must never be resurrected: that is the difference
   * between a helpful restore and a workout that won't stop coming back.
   */
  async active(): Promise<WorkoutSession | null> {
    const row = await getDatabase().getFirstAsync<SessionRow>(
      `${SELECT} WHERE status IN ('active', 'paused') ORDER BY updated_at DESC LIMIT 1`,
    );
    return row ? rowToSession(row) : null;
  },

  async listRecent(limit = 20): Promise<WorkoutSession[]> {
    const rows = await getDatabase().getAllAsync<SessionRow>(
      `${SELECT} ORDER BY updated_at DESC LIMIT ?`,
      limit,
    );
    return rows.map(rowToSession);
  },

  /** Targeted column update: avoids a read-modify-write round trip per tick. */
  async patch(id: string, patch: SessionPatch): Promise<void> {
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    const put = (column: string, value: string | number | null) => {
      sets.push(`${column} = ?`);
      args.push(value);
    };

    if (patch.entries !== undefined) put('entries_json', stringify(patch.entries));
    if (patch.elapsedSeconds !== undefined) put('elapsed_seconds', patch.elapsedSeconds);
    if (patch.status !== undefined) put('status', patch.status);
    if (patch.activeIndex !== undefined) put('active_index', patch.activeIndex);
    if (patch.restEndsAt !== undefined) put('rest_ends_at', patch.restEndsAt);
    if (patch.restDurationSeconds !== undefined) {
      put('rest_duration', patch.restDurationSeconds);
    }
    if (patch.notes !== undefined) put('notes', patch.notes);
    if (sets.length === 0) return;

    await getDatabase().runAsync(
      `UPDATE sessions SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
      ...args,
      Date.now(),
      id,
    );
  },

  /** Rest timers are cleared by nulling the deadline. */
  async clearRest(id: string): Promise<void> {
    await this.patch(id, { restEndsAt: null, restDurationSeconds: null });
  },

  async setStatus(id: string, status: WorkoutSessionStatus): Promise<void> {
    await this.patch(id, { status });
  },

  /**
   * Drops stale sessions so a long-dead workout cannot haunt the restore prompt
   * forever, and removes terminal ones that are already represented in
   * `activities`.
   */
  async prune(cutoff: number): Promise<void> {
    await getDatabase().runAsync(
      `DELETE FROM sessions
       WHERE (status IN ('active', 'paused') AND updated_at < ?)
          OR (status IN ('finished', 'discarded') AND updated_at < ?)`,
      cutoff,
      cutoff,
    );
  },

  async remove(id: string): Promise<void> {
    await getDatabase().runAsync('DELETE FROM sessions WHERE id = ?', id);
  },
};

export type SessionPatch = {
  entries?: readonly StrengthEntry[];
  elapsedSeconds?: number;
  status?: WorkoutSessionStatus;
  activeIndex?: number;
  restEndsAt?: number | null;
  restDurationSeconds?: number | null;
  notes?: string | null;
};
