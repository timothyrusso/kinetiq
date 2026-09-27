import { AppErrorBase } from '@/features/core/error';

/** The text or the file is larger than any routines file anyone meant to import. */
export class ImportTooLarge extends AppErrorBase('ImportTooLarge', 'dataTransfer.errorTooLarge') {}
