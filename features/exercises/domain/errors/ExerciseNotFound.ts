import { AppErrorBase } from '@/features/core/error';

/** The installed catalog has no exercise `exerciseId`: wger has retired it, or it never had it. */
export class ExerciseNotFound extends AppErrorBase('ExerciseNotFound', 'errors.exerciseNotFound')<{
  readonly exerciseId: string;
}> {}
