import { Effect, Option, Schema } from 'effect';
import { DecodeError } from '@/features/core/error';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';

/** Decodes the rows a query returned against `schema`, failing with a `DecodeError` naming `table`. */
export const decodeRows =
  <A, I>(schema: Schema.Schema<A, I>, table: string) =>
  (rows: unknown): Effect.Effect<readonly A[], DecodeError> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows).pipe(
      Effect.mapError(cause => new DecodeError({ source: table, cause })),
    );

/** A nullable field an older write may have left out (`JSON.stringify` drops `undefined`). */
const orNull = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.optionalWith(Schema.NullOr(schema), { default: () => null });

/** The rest a stored entry without one reads with: the settings' default. */
const STORED_REST_SECONDS = 90;

/** A set as the column stores it, tolerating what older writes left out. */
const StoredSetSchema = Schema.Struct({
  index: Schema.Number,
  reps: Schema.Number,
  weightKg: Schema.Number,
  completed: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  estimated1rm: orNull(Schema.Number),
  rpe: orNull(Schema.Number),
});

/**
 * An entry as the column stores it. Only what the history cannot show without (the exercise and
 * its sets) is required; the rest reads as its empty value, as `main` read any stored array.
 */
const StoredEntrySchema = Schema.Struct({
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  muscleGroup: orNull(Schema.String),
  sets: Schema.Array(StoredSetSchema),
  notes: orNull(Schema.String),
  restSeconds: Schema.optionalWith(Schema.Number, { default: () => STORED_REST_SECONDS }),
});

const parseColumn = Schema.decodeUnknownOption(Schema.parseJson(Schema.Array(Schema.Unknown)));
const decodeEntry = Schema.decodeUnknownOption(StoredEntrySchema);

/**
 * An `entries_json` column as its entries. A column that is empty, does not parse, or is not a
 * list reads as no entries, and an entry with no exercise or no sets is dropped, keeping the rest
 * of the row: one damaged entry degrades to a missing exercise rather than blanking the workout
 * or the history it sits in.
 */
export function entriesFromColumn(raw: string | null): readonly StrengthEntry[] {
  if (raw === null || raw.length === 0) return [];
  const stored = Option.getOrElse(parseColumn(raw), (): readonly unknown[] => []);
  return stored.flatMap(entry => Option.toArray(decodeEntry(entry)));
}

/** Entries as their `entries_json` column. */
export function entriesToColumn(entries: readonly StrengthEntry[]): string {
  return JSON.stringify(entries);
}
