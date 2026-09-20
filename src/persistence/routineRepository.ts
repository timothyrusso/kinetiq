/**
 * Routine repository.
 *
 * The important invariant lives in `save`: a routine is written together with
 * frozen `ExerciseSnapshot`s for every item, in one transaction. That is what
 * makes "my routines work on a plane" true — rendering a routine never needs the
 * network, and a half-saved routine can never be observed.
 */
import { getDatabase } from './database';
import { rowToExerciseSnapshot, rowToRoutine, stringify } from './codec';
import type { ExerciseRow, RoutineItemRow, RoutineRow } from './rows';
import type { Exercise, ExerciseSnapshot, Routine, RoutineItem } from '@/domain/types';
import { localId } from '@/utils/functional';

export type RoutineDraft = {
  id?: string;
  name: string;
  description: string | null;
  items: RoutineItem[];
  /** Snapshots keyed by exerciseId; required for any item not already stored. */
  snapshots?: readonly ExerciseSnapshot[];
};

export const routineRepository = {
  async list(): Promise<Routine[]> {
    const db = getDatabase();
    const [rows, items] = await Promise.all([
      db.getAllAsync<RoutineRow>(
        `SELECT id, name, description, created_at, updated_at, times_completed,
                last_performed_at, seeded
         FROM routines ORDER BY updated_at DESC`,
      ),
      db.getAllAsync<RoutineItemRow>(
        `SELECT id, routine_id, exercise_id, position, sets, reps, weight_kg,
                rest_seconds, notes, exercise_name
         FROM routine_items ORDER BY position ASC`,
      ),
    ]);
    const byRoutine = new Map<string, RoutineItemRow[]>();
    for (const item of items) {
      const bucket = byRoutine.get(item.routine_id);
      if (bucket) bucket.push(item);
      else byRoutine.set(item.routine_id, [item]);
    }
    return rows.map((row) => rowToRoutine(row, byRoutine.get(row.id) ?? []));
  },

  async byId(id: string): Promise<Routine | null> {
    const db = getDatabase();
    const [row, items] = await Promise.all([
      db.getFirstAsync<RoutineRow>(
        `SELECT id, name, description, created_at, updated_at, times_completed,
                last_performed_at, seeded FROM routines WHERE id = ?`,
        id,
      ),
      db.getAllAsync<RoutineItemRow>(
        `SELECT id, routine_id, exercise_id, position, sets, reps, weight_kg,
                rest_seconds, notes, exercise_name
         FROM routine_items WHERE routine_id = ? ORDER BY position ASC`,
        id,
      ),
    ]);
    if (!row) return null;
    return rowToRoutine(row, items);
  },

  /** Snapshots for a routine's items, keyed by exercise id. */
  async snapshotsFor(routineId: string): Promise<Map<string, ExerciseSnapshot>> {
    const rows = await getDatabase().getAllAsync<ExerciseRow>(
      `SELECT e.* FROM exercises e
       JOIN routine_items i ON i.exercise_id = e.id
       WHERE i.routine_id = ?`,
      routineId,
    );
    const map = new Map<string, ExerciseSnapshot>();
    for (const row of rows) map.set(row.id, rowToExerciseSnapshot(row));
    return map;
  },

  /**
   * Inserts or replaces a routine and its items atomically. Item list is
   * replaced wholesale — simpler and safer than diffing, and routine item counts
   * are small enough that it costs nothing.
   */
  async save(draft: RoutineDraft): Promise<Routine> {
    const db = getDatabase();
    const now = Date.now();
    const id = draft.id ?? localId('rtn');

    await db.withExclusiveTransactionAsync(async () => {
      const existing = await db.getFirstAsync<{ created_at: number }>(
        'SELECT created_at FROM routines WHERE id = ?',
        id,
      );

      await db.runAsync(
        `INSERT INTO routines (id, name, description, created_at, updated_at,
                               times_completed, last_performed_at, seeded)
         VALUES (?, ?, ?, ?, ?, 0, NULL, 0)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           updated_at = excluded.updated_at`,
        id,
        draft.name.trim() || 'Untitled routine',
        draft.description?.trim() || null,
        existing?.created_at ?? now,
        now,
      );

      await db.runAsync('DELETE FROM routine_items WHERE routine_id = ?', id);
      let position = 0;
      for (const item of draft.items) {
        await db.runAsync(
          `INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps,
                                      weight_kg, rest_seconds, notes, exercise_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          id,
          item.exerciseId,
          position++,
          item.sets,
          item.reps,
          item.weightKg,
          item.restSeconds,
          item.notes,
          item.exerciseName.trim() || nameFor(item.exerciseId, draft.snapshots),
        );
      }

      for (const snapshot of draft.snapshots ?? []) {
        await upsertSnapshot(snapshot);
      }
    });

    const saved = await this.byId(id);
    if (!saved) throw new Error(`routine ${id} vanished after save`);
    return saved;
  },

  async remove(id: string): Promise<void> {
    // routine_items cascade via FK, so only the parent needs deleting.
    await getDatabase().runAsync('DELETE FROM routines WHERE id = ?', id);
  },

  async rename(id: string, name: string): Promise<void> {
    await getDatabase().runAsync(
      'UPDATE routines SET name = ?, updated_at = ? WHERE id = ?',
      name.trim() || 'Untitled routine',
      Date.now(),
      id,
    );
  },

  async duplicate(id: string, name: string): Promise<Routine | null> {
    const source = await this.byId(id);
    if (!source) return null;
    const items: RoutineItem[] = source.items.map((item) => ({ ...item, id: localId('rit') }));
    const owned = new Set(items.map((item) => item.exerciseId));
    const stored = await this.snapshotsFor(source.id);
    return this.save({
      name: name.trim() || `${source.name} copy`,
      description: source.description,
      items,
      snapshots: [...stored.values()].filter((s) => owned.has(s.exerciseId)),
    });
  },

  /** Reorders by the given exercise-item ids; anything omitted keeps relative order. */
  async reorder(id: string, orderedItemIds: readonly string[]): Promise<Routine | null> {
    const routine = await this.byId(id);
    if (!routine) return null;
    const byId = new Map(routine.items.map((item) => [item.id, item]));
    const ordered: RoutineItem[] = [];
    for (const itemId of orderedItemIds) {
      const item = byId.get(itemId);
      if (item) {
        ordered.push(item);
        byId.delete(itemId);
      }
    }
    for (const item of byId.values()) ordered.push(item);

    const db = getDatabase();
    await db.withExclusiveTransactionAsync(async () => {
      let position = 0;
      for (const item of ordered) {
        await db.runAsync('UPDATE routine_items SET position = ? WHERE id = ?', position++, item.id);
      }
      await db.runAsync('UPDATE routines SET updated_at = ? WHERE id = ?', Date.now(), id);
    });
    return this.byId(id);
  },

  /**
   * Updates only the fields present in `patch`. Notes are special-cased: a
   * `null` there means "the user cleared it", not "leave it", so absent keys are
   * omitted from the statement rather than bound as NULL.
   */
  async setItem(
    itemId: string,
    patch: {
      sets?: number;
      reps?: string;
      weightKg?: number;
      restSeconds?: number;
      notes?: string | null;
    },
  ): Promise<void> {
    const db = getDatabase();
    const row = await db.getFirstAsync<RoutineItemRow>(
      'SELECT id, routine_id FROM routine_items WHERE id = ?',
      itemId,
    );
    if (!row) return;

    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    const put = (column: string, value: string | number | null) => {
      sets.push(`${column} = ?`);
      args.push(value);
    };
    if (patch.sets !== undefined) put('sets', patch.sets);
    if (patch.reps !== undefined) put('reps', patch.reps);
    if (patch.weightKg !== undefined) put('weight_kg', patch.weightKg);
    if (patch.restSeconds !== undefined) put('rest_seconds', patch.restSeconds);
    if ('notes' in patch) put('notes', patch.notes ?? null);
    if (sets.length === 0) return;

    await db.runAsync(
      `UPDATE routine_items SET ${sets.join(', ')} WHERE id = ?`,
      ...args,
      itemId,
    );
    await db.runAsync(
      'UPDATE routines SET updated_at = ? WHERE id = ?',
      Date.now(),
      row.routine_id,
    );
  },

  async addItem(routineId: string, item: RoutineItem, snapshot: ExerciseSnapshot): Promise<void> {
    const db = getDatabase();
    await db.withExclusiveTransactionAsync(async () => {
      const top = await db.getFirstAsync<{ max: number | null }>(
        'SELECT MAX(position) AS max FROM routine_items WHERE routine_id = ?',
        routineId,
      );
      await upsertSnapshot(snapshot);
      await db.runAsync(
        `INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps,
                                    weight_kg, rest_seconds, notes, exercise_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        routineId,
        item.exerciseId,
        (top?.max ?? -1) + 1,
        item.sets,
        item.reps,
        item.weightKg,
        item.restSeconds,
        item.notes,
        item.exerciseName.trim() || snapshot.name,
      );
      await db.runAsync('UPDATE routines SET updated_at = ? WHERE id = ?', Date.now(), routineId);
    });
  },

  async removeItem(routineId: string, itemId: string): Promise<void> {
    const db = getDatabase();
    await db.runAsync('DELETE FROM routine_items WHERE id = ? AND routine_id = ?', itemId, routineId);
    await db.runAsync('UPDATE routines SET updated_at = ? WHERE id = ?', Date.now(), routineId);
    await renumber(db, routineId);
  },

  /** Bookkeeping after a session is recorded against this routine. */
  async markPerformed(id: string, atTime: number): Promise<void> {
    await getDatabase().runAsync(
      `UPDATE routines
         SET times_completed = times_completed + 1,
             last_performed_at = MAX(COALESCE(last_performed_at, 0), ?)
       WHERE id = ?`,
      atTime,
      id,
    );
  },

  /**
   * Seed-only maintenance: `save` always stamps updated_at to now, which would
   * make a freshly seeded set of routines indistinguishable from ones just
   * edited. Back-fills the bookkeeping columns the normal write path owns.
   */
  async backfillStats(
    id: string,
    stats: { timesCompleted: number; lastPerformedAt: number | null; createdAt: number; updatedAt: number },
  ): Promise<void> {
    await getDatabase().runAsync(
      `UPDATE routines
         SET times_completed = ?, last_performed_at = ?, created_at = ?, updated_at = ?,
             seeded = 1
       WHERE id = ?`,
      stats.timesCompleted,
      stats.lastPerformedAt,
      stats.createdAt,
      stats.updatedAt,
      id,
    );
  },
};

async function renumber(db: ReturnType<typeof getDatabase>, routineId: string): Promise<void> {
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM routine_items WHERE routine_id = ? ORDER BY position ASC',
    routineId,
  );
  let position = 0;
  for (const row of rows) {
    await db.runAsync('UPDATE routine_items SET position = ? WHERE id = ?', position++, row.id);
  }
}

function nameFor(
  exerciseId: string,
  snapshots: readonly ExerciseSnapshot[] | undefined,
): string {
  return snapshots?.find((s) => s.exerciseId === exerciseId)?.name ?? '';
}

export async function upsertSnapshot(snapshot: ExerciseSnapshot): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO exercises (id, name, external_id, instructions, category,
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
       captured_at = excluded.captured_at`,
    snapshot.exerciseId,
    snapshot.name,
    snapshot.externalId,
    snapshot.instructions,
    snapshot.category,
    stringify(snapshot.primaryMuscles),
    stringify(snapshot.secondaryMuscles),
    stringify(snapshot.equipment),
    snapshot.imageUrl,
    snapshot.thumbnailUrl ?? snapshot.imageUrl,
    // Snapshots of seeded/local exercises exist (a routine can mix both), and
    // mislabelling them as 'remote' would make the UI offer to "refresh" data
    // that has no remote counterpart.
    snapshot.externalId === null ? 'local' : 'remote',
    snapshot.capturedAt,
  );
}

/** Builds a storable snapshot from a live provider exercise. */
export function snapshotOf(exercise: Exercise): ExerciseSnapshot {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    instructions: exercise.instructions,
    category: exercise.category,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.equipment,
    imageUrl: exercise.imageUrl,
    // A list row with only full-size art still needs *something*, so fall back.
    thumbnailUrl: exercise.thumbnailUrl ?? exercise.imageUrl,
    externalId: exercise.externalId,
    capturedAt: Date.now(),
  };
}

export async function snapshotsOf(exerciseIds: readonly string[]): Promise<ExerciseSnapshot[]> {
  if (exerciseIds.length === 0) return [];
  const rows = await getDatabase().getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises WHERE id IN (${exerciseIds.map(() => '?').join(', ')})`,
    ...exerciseIds,
  );
  return rows.map(rowToExerciseSnapshot);
}

/**
 * One stored exercise, or null when we have never seen it.
 *
 * The exercise detail screen reads this *before* it goes to the network, which is what
 * makes a saved exercise readable on a plane: anything the user has ever added to a
 * routine has a row here. `snapshotsOf` covers the batch case; this is the single-id one,
 * and the distinction is a `LIMIT 1` plan rather than a one-element `IN` list.
 */
export async function snapshotById(exerciseId: string): Promise<ExerciseSnapshot | null> {
  const row = await getDatabase().getFirstAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE id = ?',
    exerciseId,
  );
  return row === null ? null : rowToExerciseSnapshot(row);
}
