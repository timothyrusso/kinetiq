/**
 * The import that has been read but not yet confirmed.
 *
 * The data screen reads the clipboard or a file and parses it; the preview screen shows it and
 * writes it. What travels between them can be tens of kilobytes, which does not belong in a
 * route param, so it waits here. It is a plain module slot rather than a store: exactly one
 * screen reads it, once, on mount, and nothing re-renders when it changes.
 */
import { localId } from '@/utils/functional';
import type { ParseIssue, ParsedRoutine } from './parseRoutines';

export type StagedImport = {
  /** New for every stage, so the preview's lookup query never serves a previous paste. */
  id: string;
  routines: ParsedRoutine[];
  issues: ParseIssue[];
};

let staged: StagedImport | null = null;

export function stageImport(routines: ParsedRoutine[], issues: ParseIssue[]): void {
  staged = { id: localId('imp'), routines, issues };
}

export function stagedImport(): StagedImport | null {
  return staged;
}

export function clearStagedImport(): void {
  staged = null;
}
