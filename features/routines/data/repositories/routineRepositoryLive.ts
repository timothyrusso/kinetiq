import { Clock, Effect, Layer, PubSub } from 'effect';
import { SqliteClient, type SqliteDatabase, trySql } from '@/features/core/sqlite';
import { localId } from '@/features/core/utils';
import {
  decodeRoutineItemRows,
  decodeRoutineRows,
  decodeRoutineSetRows,
  routineFromRows,
  routinesFromRows,
} from '@/features/routines/data/adapters/routineRows';
import type { ItemPatch } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineChangeKind } from '@/features/routines/domain/entities/RoutineChanged';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { RoutineItem, RoutineSet } from '@/features/routines/domain/schemas/RoutineSchema';
import { RoutineEvents } from '@/features/routines/domain/services/RoutineEvents';

const SELECT_ROUTINES = `SELECT id, name, created_at, updated_at, times_completed,
                last_performed_at
         FROM routines`;

const SELECT_ITEMS = `SELECT id, routine_id, exercise_id, position, rest_seconds, notes, exercise_name,
                tracking_type
         FROM routine_items`;

const SELECT_SETS = `SELECT item_id, position, reps, weight_kg, duration_seconds, target_rpe
         FROM routine_item_sets`;

const INSERT_ITEM = `INSERT INTO routine_items (id, routine_id, exercise_id, position, rest_seconds, notes,
                                      exercise_name, tracking_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_SET = `INSERT INTO routine_item_sets (item_id, position, reps, weight_kg, duration_seconds,
                                          target_rpe)
           VALUES (?, ?, ?, ?, ?, ?)`;

// NOTE: explicit rather than left to the cascade: an exclusive transaction runs on its own
// connection, where foreign keys are off.
const DELETE_ROUTINE_SETS =
  'DELETE FROM routine_item_sets WHERE item_id IN (SELECT id FROM routine_items WHERE routine_id = ?)';

const TOUCH_ROUTINE = 'UPDATE routines SET updated_at = ? WHERE id = ?';

const UNTITLED = 'Untitled routine';

const itemValues = (routineId: RoutineId, item: RoutineItem, position: number) => [
  item.id,
  routineId,
  item.exerciseId,
  position,
  item.restSeconds,
  item.notes,
  item.exerciseName.trim(),
  item.trackingType,
];

/** A set's `reps`, `weight_kg` and `duration_seconds` columns: null where its type records none. */
function setColumns(set: RoutineSet): [number | null, number | null, number | null] {
  switch (set.type) {
    case 'weightReps':
      return [set.reps, set.weightKg, null];
    case 'repsOnly':
      return [set.reps, null, null];
    case 'duration':
      return [null, null, set.durationSeconds];
  }
}

/** Writes `sets` as the item's set rows, numbered from 0 in their order. */
async function insertSets(txn: SqliteDatabase, itemId: string, sets: readonly RoutineSet[]): Promise<void> {
  let position = 0;
  for (const set of sets) {
    await txn.runAsync(INSERT_SET, [itemId, position++, ...setColumns(set), set.targetRpe]);
  }
}

/** The columns `setItem` may change, by target; `sets` replaces the item's set rows instead. */
const ITEM_COLUMNS = {
  restSeconds: 'rest_seconds',
  trackingType: 'tracking_type',
} as const satisfies Record<Exclude<keyof ItemPatch, 'notes' | 'sets'>, string>;

/** `SET` assignments and their values for the targets present in `patch`; `notes` may be null. */
function itemAssignments(patch: ItemPatch): { columns: string[]; values: (string | number | null)[] } {
  const columns: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [target, column] of Object.entries(ITEM_COLUMNS) as [keyof typeof ITEM_COLUMNS, string][]) {
    const value = patch[target];
    if (value === undefined) continue;
    columns.push(`${column} = ?`);
    values.push(value);
  }
  if ('notes' in patch) {
    columns.push('notes = ?');
    values.push(patch.notes ?? null);
  }
  return { columns, values };
}

/**
 * The routines in the app database's `routines` and `routine_items` tables. The multi-statement
 * writes run in an exclusive transaction, on its own connection: a failure anywhere leaves the
 * routine as it was, and nothing else can interleave a statement into it.
 */
export const RoutineRepositoryLive = Layer.effect(
  RoutineRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    const events = yield* RoutineEvents;

    const announce = (routineId: RoutineId, kind: RoutineChangeKind) =>
      PubSub.publish(events, { routineId, kind }).pipe(Effect.asVoid);

    const byId = (id: RoutineId) =>
      Effect.gen(function* () {
        const [rows, items, sets] = yield* Effect.all([
          trySql('read a routine', () => db.getAllAsync<unknown>(`${SELECT_ROUTINES} WHERE id = ?`, [id])).pipe(
            Effect.flatMap(decodeRoutineRows),
          ),
          trySql('read a routine’s items', () =>
            db.getAllAsync<unknown>(`${SELECT_ITEMS} WHERE routine_id = ? ORDER BY position ASC`, [id]),
          ).pipe(Effect.flatMap(decodeRoutineItemRows)),
          trySql('read a routine’s sets', () =>
            db.getAllAsync<unknown>(
              `${SELECT_SETS} WHERE item_id IN (SELECT id FROM routine_items WHERE routine_id = ?)`,
              [id],
            ),
          ).pipe(Effect.flatMap(decodeRoutineSetRows)),
        ]);
        const [row] = rows;
        return row === undefined ? undefined : yield* routineFromRows(row, items, sets);
      });

    return {
      list: Effect.gen(function* () {
        const [rows, items, sets] = yield* Effect.all([
          trySql('list routines', () => db.getAllAsync<unknown>(`${SELECT_ROUTINES} ORDER BY updated_at DESC`)).pipe(
            Effect.flatMap(decodeRoutineRows),
          ),
          trySql('list routine items', () => db.getAllAsync<unknown>(`${SELECT_ITEMS} ORDER BY position ASC`)).pipe(
            Effect.flatMap(decodeRoutineItemRows),
          ),
          trySql('list routine sets', () => db.getAllAsync<unknown>(SELECT_SETS)).pipe(
            Effect.flatMap(decodeRoutineSetRows),
          ),
        ]);
        return yield* routinesFromRows(rows, items, sets);
      }),

      byId,

      save: input =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const id = input.id ?? RoutineId.make(localId('rtn'));
          yield* trySql('save a routine', () =>
            db.withExclusiveTransactionAsync(async txn => {
              await txn.runAsync(
                `INSERT INTO routines (id, name, created_at, updated_at,
                               times_completed, last_performed_at)
         VALUES (?, ?, ?, ?, 0, NULL)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           updated_at = excluded.updated_at`,
                [id, input.name.trim() || UNTITLED, now, now],
              );
              await txn.runAsync(DELETE_ROUTINE_SETS, [id]);
              await txn.runAsync('DELETE FROM routine_items WHERE routine_id = ?', [id]);
              let position = 0;
              for (const item of input.items) {
                await txn.runAsync(INSERT_ITEM, itemValues(id, item, position++));
                await insertSets(txn, item.id, item.sets);
              }
            }),
          );
          yield* announce(id, 'saved');
          const saved = yield* byId(id);
          if (saved === undefined) return yield* Effect.dieMessage(`routine ${id} vanished after save`);
          return saved;
        }),

      rename: (id, name) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('rename a routine', () =>
            db.runAsync('UPDATE routines SET name = ?, updated_at = ? WHERE id = ?', [
              name.trim() || UNTITLED,
              now,
              id,
            ]),
          );
          yield* announce(id, 'renamed');
        }),

      delete: id =>
        trySql('delete a routine', () =>
          db.withExclusiveTransactionAsync(async txn => {
            await txn.runAsync(DELETE_ROUTINE_SETS, [id]);
            await txn.runAsync('DELETE FROM routine_items WHERE routine_id = ?', [id]);
            await txn.runAsync('DELETE FROM routines WHERE id = ?', [id]);
          }),
        ).pipe(Effect.zipRight(announce(id, 'deleted'))),

      reorder: (id, orderedItemIds) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('reorder a routine', () =>
            db.withExclusiveTransactionAsync(async txn => {
              let position = 0;
              for (const itemId of orderedItemIds) {
                await txn.runAsync('UPDATE routine_items SET position = ? WHERE id = ?', [position++, itemId]);
              }
              await txn.runAsync(TOUCH_ROUTINE, [now, id]);
            }),
          );
          yield* announce(id, 'reordered');
        }),

      setItem: (itemId, patch) =>
        Effect.gen(function* () {
          const { columns, values } = itemAssignments(patch);
          const { sets } = patch;
          if (columns.length === 0 && sets === undefined) return;
          const [owner] = yield* trySql('find a routine item', () =>
            db.getAllAsync<unknown>(`${SELECT_ITEMS} WHERE id = ?`, [itemId]),
          ).pipe(Effect.flatMap(decodeRoutineItemRows));
          if (owner === undefined) return;
          const routineId = RoutineId.make(owner.routine_id);
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('change a routine item', () =>
            db.withExclusiveTransactionAsync(async txn => {
              if (columns.length > 0) {
                await txn.runAsync(`UPDATE routine_items SET ${columns.join(', ')} WHERE id = ?`, [...values, itemId]);
              }
              if (sets !== undefined) {
                await txn.runAsync('DELETE FROM routine_item_sets WHERE item_id = ?', [itemId]);
                await insertSets(txn, itemId, sets);
              }
              await txn.runAsync(TOUCH_ROUTINE, [now, routineId]);
            }),
          );
          yield* announce(routineId, 'itemsChanged');
        }),

      addItem: (id, item) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('add a routine item', () =>
            db.withExclusiveTransactionAsync(async txn => {
              await txn.runAsync(
                `INSERT INTO routine_items (id, routine_id, exercise_id, position, rest_seconds, notes,
                                    exercise_name, tracking_type)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM routine_items WHERE routine_id = ?),
                 ?, ?, ?, ?)`,
                [
                  item.id,
                  id,
                  item.exerciseId,
                  id,
                  item.restSeconds,
                  item.notes,
                  item.exerciseName.trim(),
                  item.trackingType,
                ],
              );
              await insertSets(txn, item.id, item.sets);
              await txn.runAsync(TOUCH_ROUTINE, [now, id]);
            }),
          );
          yield* announce(id, 'itemsChanged');
        }),

      removeItem: (id, itemId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('remove a routine item', async () => {
            await db.runAsync(
              'DELETE FROM routine_item_sets WHERE item_id IN (SELECT id FROM routine_items WHERE id = ? AND routine_id = ?)',
              [itemId, id],
            );
            await db.runAsync('DELETE FROM routine_items WHERE id = ? AND routine_id = ?', [itemId, id]);
            await db.runAsync(TOUCH_ROUTINE, [now, id]);
          });
          const rest = yield* trySql('read a routine’s items', () =>
            db.getAllAsync<unknown>(`${SELECT_ITEMS} WHERE routine_id = ? ORDER BY position ASC`, [id]),
          ).pipe(Effect.flatMap(decodeRoutineItemRows));
          yield* trySql('renumber a routine’s items', async () => {
            let position = 0;
            for (const row of rest) {
              await db.runAsync('UPDATE routine_items SET position = ? WHERE id = ?', [position++, row.id]);
            }
          });
          yield* announce(id, 'itemsChanged');
        }),

      markUsed: (id, performedAt) =>
        trySql('mark a routine used', () =>
          db.runAsync(
            `UPDATE routines
         SET times_completed = times_completed + 1,
             last_performed_at = MAX(COALESCE(last_performed_at, 0), ?)
       WHERE id = ?`,
            [performedAt, id],
          ),
        ).pipe(Effect.zipRight(announce(id, 'used'))),

      replaceItems: (id, items) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('replace a routine’s items', async () => {
            await db.runAsync(DELETE_ROUTINE_SETS, [id]);
            await db.runAsync('DELETE FROM routine_items WHERE routine_id = ?', [id]);
            let position = 0;
            for (const item of items) {
              await db.runAsync(INSERT_ITEM, itemValues(id, item, position++));
              await insertSets(db, item.id, item.sets);
            }
            await db.runAsync(TOUCH_ROUTINE, [now, id]);
          });
          yield* announce(id, 'itemsChanged');
        }),
    };
  }),
);
