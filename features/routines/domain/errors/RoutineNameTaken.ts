import { AppErrorBase } from '@/features/core/error';

/** Another routine is already called `name`, ignoring case and the spaces around it. */
export class RoutineNameTaken extends AppErrorBase('RoutineNameTaken', 'errors.routineNameTaken')<{
  readonly name: string;
}> {}
