import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { ItemTarget } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineInput } from '@/features/routines/domain/entities/RoutineInput';
import type { RoutineId } from '@/features/routines/domain/schemas/RoutineId';
import type { Routine, RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/** A read of the routine tables: a statement failed, or a row is not the shape it should be. */
type RoutineReadError = SqlError | DecodeError;

/**
 * The routines on the device. Every write publishes a `RoutineChanged` on `RoutineEvents` once it
 * has landed; a write to a routine that does not exist changes nothing. An item's exercise must be
 * stored before the item is written: `routine_items.exercise_id` references `exercises`.
 */
export class RoutineRepository extends Context.Tag('routines/RoutineRepository')<
  RoutineRepository,
  {
    /** Every routine, most recently changed first, each with its items in order. */
    readonly list: Effect.Effect<readonly Routine[], RoutineReadError>;
    /** The routine `id` with its items in order, or `undefined` when there is none. */
    readonly byId: (id: RoutineId) => Effect.Effect<Routine | undefined, RoutineReadError>;
    /**
     * Writes a routine and replaces its items wholesale, in one exclusive transaction, and returns
     * it as stored. A new routine gets an id; a blank name is stored as `Untitled routine`.
     */
    readonly save: (input: RoutineInput) => Effect.Effect<Routine, RoutineReadError>;
    /** Renames the routine; a blank name is stored as `Untitled routine`. */
    readonly rename: (id: RoutineId, name: string) => Effect.Effect<void, SqlError>;
    /** Deletes the routine; its items go with it. */
    readonly delete: (id: RoutineId) => Effect.Effect<void, SqlError>;
    /** Numbers the routine's items in the order of `orderedItemIds`, in one exclusive transaction. */
    readonly reorder: (id: RoutineId, orderedItemIds: readonly string[]) => Effect.Effect<void, SqlError>;
    /**
     * Changes only the targets present in `patch`. A `notes` key set to `null` clears the note; an
     * absent key leaves it. An unknown item changes nothing and publishes nothing.
     */
    readonly setItem: (itemId: string, patch: Partial<ItemTarget>) => Effect.Effect<void, RoutineReadError>;
    /** Appends `item` after the routine's last item, in one exclusive transaction. */
    readonly addItem: (id: RoutineId, item: RoutineItem) => Effect.Effect<void, SqlError>;
    /** Removes the item and numbers the rest from 0 again. */
    readonly removeItem: (id: RoutineId, itemId: string) => Effect.Effect<void, RoutineReadError>;
    /** Counts one more workout from the routine, keeping the latest `performedAt` as the last one. */
    readonly markUsed: (id: RoutineId, performedAt: number) => Effect.Effect<void, SqlError>;
  }
>() {}
