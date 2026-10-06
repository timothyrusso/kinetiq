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

/** What every stored set carries, tolerating what older writes left out. */
const storedSetFields = {
  index: Schema.Number,
  completed: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  rpe: orNull(Schema.Number),
  routineSetIndex: Schema.optional(Schema.Number),
};

/** What every stored entry carries besides its type and sets. */
const storedEntryFields = {
  exerciseId: Schema.String,
  exerciseName: Schema.String,
  muscleGroup: orNull(Schema.String),
  notes: orNull(Schema.String),
  restSeconds: Schema.optionalWith(Schema.Number, { default: () => STORED_REST_SECONDS }),
  routineItemId: Schema.optional(Schema.String),
};

/**
 * An entry as the column stores it, one struct per tracking type. Every set must carry its
 * entry's type as its own `type`: a set of another type fails the entry, as a damaged one does.
 * Only what the history cannot show without (the exercise and its sets) is required; the rest
 * reads as its empty value, as `main` read any stored array.
 */
const StoredEntrySchema = Schema.Union(
  Schema.Struct({
    trackingType: Schema.Literal('weightReps'),
    ...storedEntryFields,
    sets: Schema.Array(
      Schema.Struct({
        type: Schema.Literal('weightReps'),
        ...storedSetFields,
        reps: Schema.Number,
        weightKg: Schema.Number,
        estimated1rm: orNull(Schema.Number),
      }),
    ),
  }),
  Schema.Struct({
    trackingType: Schema.Literal('repsOnly'),
    ...storedEntryFields,
    sets: Schema.Array(Schema.Struct({ type: Schema.Literal('repsOnly'), ...storedSetFields, reps: Schema.Number })),
  }),
  Schema.Struct({
    trackingType: Schema.Literal('duration'),
    ...storedEntryFields,
    sets: Schema.Array(
      Schema.Struct({ type: Schema.Literal('duration'), ...storedSetFields, durationSeconds: Schema.Number }),
    ),
  }),
);

const parseColumn = Schema.decodeUnknownOption(Schema.parseJson(Schema.Array(Schema.Unknown)));
const decodeEntry = Schema.decodeUnknownOption(StoredEntrySchema);

/**
 * An `entries_json` column as its entries. A column that is empty, does not parse, or is not a
 * list reads as no entries, and an entry with no exercise, no sets, no tracking type, or a set of
 * another type than its own is dropped, keeping the rest of the row: one damaged entry degrades to a missing
 * exercise rather than blanking the workout or the history it sits in.
 */
export function entriesFromColumn(raw: string | null): readonly StrengthEntry[] {
  if (raw === null || raw.length === 0) return [];
  return entriesFromList(Option.getOrElse(parseColumn(raw), (): readonly unknown[] => []));
}

/** A stored list as its entries, by the same rules as `entriesFromColumn`. */
export function entriesFromList(stored: readonly unknown[]): readonly StrengthEntry[] {
  return stored.flatMap(entry => Option.toArray(decodeEntry(entry)));
}

/** Entries as their `entries_json` column. */
export function entriesToColumn(entries: readonly StrengthEntry[]): string {
  return JSON.stringify(entries);
}
