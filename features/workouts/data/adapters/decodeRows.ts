import { Effect, Option, Schema } from 'effect';
import { DecodeError } from '@/features/core/error';
import { type StrengthEntry, StrengthEntrySchema } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** Decodes the rows a query returned against `schema`, failing with a `DecodeError` naming `table`. */
export const decodeRows =
  <A, I>(schema: Schema.Schema<A, I>, table: string) =>
  (rows: unknown): Effect.Effect<readonly A[], DecodeError> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows).pipe(
      Effect.mapError(cause => new DecodeError({ source: table, cause })),
    );

const decodeEntries = Schema.decodeUnknownOption(Schema.parseJson(Schema.Array(StrengthEntrySchema)));

/**
 * An `entries_json` column as its entries. A column that is empty, does not parse, or is not a
 * list of entries reads as no entries: one damaged row degrades to a missing field rather than
 * blanking the history it sits in.
 */
export function entriesFromColumn(raw: string | null): readonly StrengthEntry[] {
  if (raw === null || raw.length === 0) return [];
  return Option.getOrElse(decodeEntries(raw), () => []);
}

/** Entries as their `entries_json` column. */
export function entriesToColumn(entries: readonly StrengthEntry[]): string {
  return JSON.stringify(entries);
}
