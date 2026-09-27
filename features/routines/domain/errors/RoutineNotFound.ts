import { AppErrorBase } from '@/features/core/error';

/** No routine has id `routineId`: it was deleted, most likely from another screen. */
export class RoutineNotFound extends AppErrorBase('RoutineNotFound', 'errors.routineNotFound')<{
  readonly routineId: string;
}> {}
