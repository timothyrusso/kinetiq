import { AppErrorBase } from '@/features/core/error';

/** No recorded workout has id `activityId`: it was deleted, most likely from another screen. */
export class ActivityNotFound extends AppErrorBase('ActivityNotFound', 'errors.activityNotFound')<{
  readonly activityId: string;
}> {}
