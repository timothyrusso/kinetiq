import { Clock, Effect, Layer, PubSub } from 'effect';
import { SqliteClient, trySql } from '@/features/core/sqlite';
import { localId } from '@/features/core/utils';
import {
  decodeRoutineItemRows,
  decodeRoutineRows,
  routineFromRows,
  routinesFromRows,
} from '@/features/routines/data/adapters/routineRows';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineChangeKind } from '@/features/routines/domain/entities/RoutineChanged';
import { RoutineRepository } from '@/features/routines/domain/repositories/RoutineRepository';
import { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';
import { RoutineEvents } from '@/features/routines/domain/services/RoutineEvents';

const SELECT_ROUTINES = `SELECT id, name, created_at, updated_at, times_completed,
                last_performed_at
         FROM routines`;

const SELECT_ITEMS = `SELECT id, routine_id, exercise_id, position, sets, reps, weight_kg,
                rest_seconds, notes, exercise_name
         FROM routine_items`;

const INSERT_ITEM = `INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps,
                                      weight_kg, rest_seconds, notes, exercise_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const TOUCH_ROUTINE = 'UPDATE routines SET updated_at = ? WHERE id = ?';

const UNTITLED = 'Untitled routine';

const itemValues = (routineId: RoutineId, item: RoutineItem, position: number) => [
  item.id,
  routineId,
  item.exerciseId,
  position,
  item.sets,
  item.reps,
  item.weightKg,
  item.restSeconds,
  item.notes,
  item.exerciseName.trim(),
];

/** The columns `setItem` may change, by target. */
const ITEM_COLUMNS = {
  sets: 'sets',
  reps: 'reps',
  weightKg: 'weight_kg',
  restSeconds: 'rest_seconds',
} as const satisfies Record<Exclude<keyof ItemTarget, 'notes'>, string>;

/** `SET` assignments and their values for the targets present in `patch`; `notes` may be null. */
function itemAssignments(patch: Partial<ItemTarget>): { columns: string[]; values: (string | number | null)[] } {
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
        const [rows, items] = yield* Effect.all([
          trySql('read a routine', () => db.getAllAsync<unknown>(`${SELECT_ROUTINES} WHERE id = ?`, [id])).pipe(
            Effect.flatMap(decodeRoutineRows),
          ),
          trySql('read a routine’s items', () =>
            db.getAllAsync<unknown>(`${SELECT_ITEMS} WHERE routine_id = ? ORDER BY position ASC`, [id]),
          ).pipe(Effect.flatMap(decodeRoutineItemRows)),
        ]);
        const [row] = rows;
        return row === undefined ? undefined : routineFromRows(row, items);
      });

    return {
      list: Effect.gen(function* () {
        const [rows, items] = yield* Effect.all([
          trySql('list routines', () => db.getAllAsync<unknown>(`${SELECT_ROUTINES} ORDER BY updated_at DESC`)).pipe(
            Effect.flatMap(decodeRoutineRows),
          ),
          trySql('list routine items', () => db.getAllAsync<unknown>(`${SELECT_ITEMS} ORDER BY position ASC`)).pipe(
            Effect.flatMap(decodeRoutineItemRows),
          ),
        ]);
        return routinesFromRows(rows, items);
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
              await txn.runAsync('DELETE FROM routine_items WHERE routine_id = ?', [id]);
              let position = 0;
              for (const item of input.items) {
                await txn.runAsync(INSERT_ITEM, itemValues(id, item, position++));
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
        trySql('delete a routine', () => db.runAsync('DELETE FROM routines WHERE id = ?', [id])).pipe(
          Effect.zipRight(announce(id, 'deleted')),
        ),

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
          if (columns.length === 0) return;
          const [owner] = yield* trySql('find a routine item', () =>
            db.getAllAsync<unknown>(`${SELECT_ITEMS} WHERE id = ?`, [itemId]),
          ).pipe(Effect.flatMap(decodeRoutineItemRows));
          if (owner === undefined) return;
          const routineId = RoutineId.make(owner.routine_id);
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('change a routine item', () =>
            db.runAsync(`UPDATE routine_items SET ${columns.join(', ')} WHERE id = ?`, [...values, itemId]),
          );
          yield* trySql('touch a routine', () => db.runAsync(TOUCH_ROUTINE, [now, routineId]));
          yield* announce(routineId, 'itemsChanged');
        }),

      addItem: (id, item) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('add a routine item', () =>
            db.withExclusiveTransactionAsync(async txn => {
              await txn.runAsync(
                `INSERT INTO routine_items (id, routine_id, exercise_id, position, sets, reps,
                                    weight_kg, rest_seconds, notes, exercise_name)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM routine_items WHERE routine_id = ?),
                 ?, ?, ?, ?, ?, ?)`,
                [
                  item.id,
                  id,
                  item.exerciseId,
                  id,
                  item.sets,
                  item.reps,
                  item.weightKg,
                  item.restSeconds,
                  item.notes,
                  item.exerciseName.trim(),
                ],
              );
              await txn.runAsync(TOUCH_ROUTINE, [now, id]);
            }),
          );
          yield* announce(id, 'itemsChanged');
        }),

      removeItem: (id, itemId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* trySql('remove a routine item', async () => {
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
    };
  }),
);
