import { AppErrorBase } from '@/features/core/error';

/** There is no watch bridge on this device: Android, or a build without the native module. */
export class WatchUnavailable extends AppErrorBase('WatchUnavailable', 'errors.watchUnavailable') {}
