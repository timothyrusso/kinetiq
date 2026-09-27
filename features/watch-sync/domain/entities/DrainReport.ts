import type { AppError } from '@/features/core/error';

/** What one drain of the inbox did: the activity ids it saved, and the failures it kept entries for. */
export interface DrainReport {
  readonly saved: readonly string[];
  readonly failures: readonly AppError[];
}
