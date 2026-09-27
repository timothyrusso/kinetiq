import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';

/**
 * The exercises the user has stored: the frozen copy a routine or a session keeps of every
 * exercise it names. Read here as the detail screen's stand-in when the catalog has no row.
 */
export class ExerciseSnapshotRepository extends Context.Tag('exercises/ExerciseSnapshotRepository')<
  ExerciseSnapshotRepository,
  {
    /** The stored copy of `exerciseId`, or `undefined` when nothing has stored it. */
    readonly byId: (exerciseId: string) => Effect.Effect<ExerciseSnapshot | undefined, SqlError | DecodeError>;
  }
>() {}
