import { AppErrorBase } from '@/features/core/error';
import type { ParseIssue } from '@/features/transfer/domain/entities/ParsedImport';

/** The text is not a routines file, or has none with exercises; `issue` says which, for the screen. */
export class ImportUnreadable extends AppErrorBase('ImportUnreadable', 'dataTransfer.errorUnreadable')<{
  readonly issue: ParseIssue;
}> {}
