import { AppErrorBase } from '@/features/core/error';

/** A workout with this id is already in history, so nothing was written again. */
export class DuplicateWorkout extends AppErrorBase('DuplicateWorkout', 'errors.duplicateWorkout')<{
  readonly activityId: string;
}> {}
