import { AppErrorBase } from '@/features/core/error/kit';

/** The device has no connection, so a remote call was not attempted or could not finish. */
export class OfflineError extends AppErrorBase('OfflineError', 'errors.offline') {}
