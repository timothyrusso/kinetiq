/**
 * The file formats Kinetiq writes and reads. Workouts go out for analysis (a spreadsheet, a
 * notebook, an AI chat); routines go out and come back in, which is what lets an AI edit them.
 * Both carry `format` and `version`, so a file says what it is and a later app can read an older
 * file instead of guessing from its shape.
 */
export const ROUTINES_FORMAT = 'kinetiq.routines';
export const WORKOUTS_FORMAT = 'kinetiq.workouts';
export const FORMAT_VERSION = 1;

/** The three exports the data screen offers. */
export type ExportTarget = 'workoutsJson' | 'setsCsv' | 'routinesJson';

/** What an export file is, for its name and for the share sheet. */
export type ExportKind = 'json' | 'csv';

/** A file ready for the share sheet. */
export interface ExportFile {
  readonly name: string;
  readonly content: string;
  readonly kind: ExportKind;
}

/** Where an import's text comes from: an AI chat's answer on the clipboard, or a file. */
export type ImportSource = 'clipboard' | 'file';
