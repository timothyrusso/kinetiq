import { Context, type Effect } from 'effect';
import type { DecodeError, SqlError } from '@/features/core/error';
import type { ActivityListQuery } from '@/features/workouts/domain/entities/ActivityListQuery';
import type { ActivityId } from '@/features/workouts/domain/schemas/ActivityId';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import type { CompletedWorkout } from '@/features/workouts/domain/schemas/CompletedWorkoutSchema';
import type { PersonalRecord } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

/** A read of the history: a statement failed, or a row is not the shape it should be. */
type ActivityReadError = SqlError | DecodeError;

/** The recorded workouts in the app database's `activities` table. */
export class ActivityRepository extends Context.Tag('workouts/ActivityRepository')<
  ActivityRepository,
  {
    readonly list: (query?: ActivityListQuery) => Effect.Effect<readonly Activity[], ActivityReadError>;
    /** The workout `id`, or `undefined` when there is none. */
    readonly byId: (id: ActivityId) => Effect.Effect<Activity | undefined, ActivityReadError>;
    /** How many workouts are recorded, without reading them. */
    readonly count: Effect.Effect<number, SqlError>;
    readonly remove: (id: ActivityId) => Effect.Effect<void, SqlError>;
    /**
     * Writes `workout` as history, with the records it set, and returns it as stored. The totals
     * are derived from the entries again; a blank title is stored as `Strength session`. Opens no
     * transaction of its own.
     */
    readonly recordWorkout: (
      workout: CompletedWorkout,
      records: readonly PersonalRecord[],
    ) => Effect.Effect<Activity, SqlError>;
  }
>() {}
