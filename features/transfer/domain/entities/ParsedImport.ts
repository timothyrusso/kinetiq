/**
 * What the import says went wrong or was changed on the way in: a catalog key of the
 * `dataTransfer` group and its values, phrased by the screen that shows it.
 */
export interface ParseIssue {
  readonly key:
    | 'dataTransfer.errorTooLarge'
    | 'dataTransfer.errorEmpty'
    | 'dataTransfer.errorNotJson'
    | 'dataTransfer.errorNoRoutines'
    | 'dataTransfer.errorIsPrompt'
    | 'dataTransfer.errorUnreadable'
    | 'dataTransfer.errorOlderFile'
    | 'dataTransfer.issueItemNoType'
    | 'dataTransfer.issueItemSkipped'
    | 'dataTransfer.issueDefaults'
    | 'dataTransfer.issueTooMany'
    | 'dataTransfer.issueRoutineSkipped';
  readonly vars?: Readonly<Record<string, number>>;
}

/**
 * One planned set as the file gave it, clamped to the editor's bounds and tagged with what it
 * records: reps at a weight, reps alone, or seconds.
 */
export type ParsedSet =
  | { readonly type: 'weightReps'; readonly reps: number; readonly weightKg: number; readonly targetRpe: number | null }
  | { readonly type: 'repsOnly'; readonly reps: number; readonly targetRpe: number | null }
  | { readonly type: 'duration'; readonly durationSeconds: number; readonly targetRpe: number | null };

/**
 * What an item's sets record. The same literals as the exercises' `TrackingType`, which a domain
 * file may not import: `saveImport` hands one to the other, so the compiler keeps the lists equal.
 */
export type ParsedTrackingType = ParsedSet['type'];

/** Every tracking type a file may name, for the parser to check a value against. */
export const TRACKING_TYPES: readonly ParsedTrackingType[] = ['weightReps', 'repsOnly', 'duration'];

/** One routine item as the file gave it, clamped to the editor's bounds. */
export interface ParsedItem {
  readonly exerciseId: string | null;
  readonly exerciseName: string;
  readonly trackingType: ParsedTrackingType;
  /** In the order they are performed; never empty, and every one of `trackingType`. */
  readonly sets: readonly ParsedSet[];
  /** Null means "use the user's default rest", decided at import time. */
  readonly restSeconds: number | null;
  readonly notes: string | null;
}

/** One routine as the file gave it. */
export interface ParsedRoutine {
  /** Null when the file gave none; the preview names it. */
  readonly name: string | null;
  readonly items: readonly ParsedItem[];
}

/** A read, not yet confirmed import: new for every paste or file, so a preview never shows a previous one. */
export interface StagedImport {
  readonly id: string;
  readonly routines: readonly ParsedRoutine[];
  readonly issues: readonly ParseIssue[];
}
