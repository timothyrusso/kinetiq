import { Effect } from 'effect';
import { ActivityRepository } from '@/features/workouts/domain/repositories/ActivityRepository';
import { RecordRepository } from '@/features/workouts/domain/repositories/RecordRepository';
import { summariseExerciseHistory } from '@/features/workouts/domain/utils/exerciseHistory';

/**
 * What the user has done with `exerciseId`, from the whole history. Workouts store their sets as
 * one JSON list each, so this is a scan of every workout, parsed before it is matched: a few
 * hundred rows, once, and cached.
 */
export const exerciseHistory = (exerciseId: string) =>
  Effect.flatMap(ActivityRepository, repository => repository.list()).pipe(
    Effect.map(activities => summariseExerciseHistory(exerciseId, activities)),
  );

/**
 * The records held for `exerciseId`, from the records table rather than the history: the log says
 * what happened, the table what the app agreed was best when it happened.
 */
export const exerciseRecords = (exerciseId: string) =>
  Effect.flatMap(RecordRepository, repository => repository.forExercise(exerciseId));
