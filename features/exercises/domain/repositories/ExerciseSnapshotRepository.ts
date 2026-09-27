import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';

/** A read of the stored snapshots: a statement failed, or a row is not the shape it should be. */
type SnapshotReadError = SqlError | DecodeError;

/**
 * The exercises the user has stored: the frozen copy a routine or a session keeps of every
 * exercise it names. Read here as the detail screen's stand-in when the catalog has no row, and
 * written before anything points at the exercise, so a saved routine opens with no network.
 */
export class ExerciseSnapshotRepository extends Context.Tag('exercises/ExerciseSnapshotRepository')<
  ExerciseSnapshotRepository,
  {
    /** The stored copy of `exerciseId`, or `undefined` when nothing has stored it. */
    readonly byId: (exerciseId: string) => Effect.Effect<ExerciseSnapshot | undefined, SnapshotReadError>;
    /** The stored copies of `exerciseIds`, by exercise id; an id nothing has stored is absent. */
    readonly byIds: (
      exerciseIds: readonly string[],
    ) => Effect.Effect<ReadonlyMap<string, ExerciseSnapshot>, SnapshotReadError>;
    /**
     * The most recently stored exercise named exactly `name`, ignoring case and the spaces around
     * it, or `undefined`. The routine importer's first guess for an item that is only a name.
     */
    readonly byName: (name: string) => Effect.Effect<ExerciseSnapshot | undefined, SnapshotReadError>;
    /**
     * Stores `snapshot`, replacing the copy of the same exercise. An image the new copy lacks keeps
     * the stored one: a search row often carries only a thumbnail.
     */
    readonly upsert: (snapshot: ExerciseSnapshot) => Effect.Effect<void, SqlError>;
  }
>() {}
