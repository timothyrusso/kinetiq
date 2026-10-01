import { Effect, Either, Schema } from 'effect';
import { DecodeError } from '@/features/core/error';
import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';

/** A row of the exercise select: the name and instructions already resolved to one language. */
export const ExerciseRow = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  instructions: Schema.NullOr(Schema.String),
  body_area: Schema.String,
  training_type: Schema.String,
  level: Schema.String,
  force: Schema.NullOr(Schema.String),
  mechanic: Schema.NullOr(Schema.String),
  image_start: Schema.NullOr(Schema.String),
  image_end: Schema.NullOr(Schema.String),
  thumbnail: Schema.NullOr(Schema.String),
});

export type ExerciseRow = typeof ExerciseRow.Type;

export const MuscleRow = Schema.Struct({
  exercise_id: Schema.String,
  muscle: Schema.String,
  role: Schema.String,
});

export const EquipmentRow = Schema.Struct({
  exercise_id: Schema.String,
  equipment: Schema.String,
});

export const KeyRow = Schema.Struct({ key: Schema.String });

export const CountRow = Schema.Struct({ n: Schema.Number });

export const MetaRow = Schema.Struct({ key: Schema.String, value: Schema.String });

/** Decodes rows of `table` with `schema`, a mismatch failing as a `DecodeError` naming the table. */
export const decodeRows =
  <A, I>(schema: Schema.Schema<A, I>, table: string) =>
  (rows: unknown): Effect.Effect<readonly A[], DecodeError> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows).pipe(
      Effect.mapError(cause => new DecodeError({ source: table, cause })),
    );

/** The `catalog_meta` key and value rows as `CatalogMeta`; a value that is not a number reads as unset. */
export function metaFromRows(rows: readonly (typeof MetaRow.Type)[]): CatalogMeta {
  const values = new Map(rows.map(row => [row.key, row.value]));
  const number = (key: string): number | null => {
    const parsed = Number(values.get(key));
    return values.has(key) && Number.isFinite(parsed) ? parsed : null;
  };
  return {
    datasetVersion: number('dataset_version'),
    installedAt: number('installed_at'),
    exerciseCount: number('exercise_count'),
    formatVersion: number('format_version'),
  };
}

const parseList = Schema.decodeUnknownEither(Schema.parseJson(Schema.Array(Schema.Unknown)));

/**
 * A JSON list column as its strings. A column that does not parse, or is not a list, reads as
 * empty, and a value that is not a string is dropped: one damaged row degrades to a missing field
 * rather than blanking the screen.
 */
export function stringList(raw: string | null): string[] {
  if (raw === null) return [];
  const parsed = parseList(raw);
  if (Either.isLeft(parsed)) return [];
  return parsed.right.filter((value): value is string => typeof value === 'string');
}
