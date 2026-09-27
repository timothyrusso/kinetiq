import { Effect, Schema } from 'effect';
import { DecodeError } from '@/features/core/error';
import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';

/** A row of the exercise select: the name and instructions already resolved to one language. */
export const ExerciseRow = Schema.Struct({
  id: Schema.String,
  external_id: Schema.Number,
  name: Schema.NullOr(Schema.String),
  instructions: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  image_url: Schema.NullOr(Schema.String),
  thumbnail_url: Schema.NullOr(Schema.String),
  video_url: Schema.NullOr(Schema.String),
});

export type ExerciseRow = typeof ExerciseRow.Type;

export const MuscleNameRow = Schema.Struct({ exercise_id: Schema.String, role: Schema.String, name: Schema.String });

export const EquipmentNameRow = Schema.Struct({ exercise_id: Schema.String, name: Schema.String });

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
    source: values.get('source') ?? null,
    generatedAt: number('generated_at'),
    installedAt: number('installed_at'),
    refreshedAt: number('refreshed_at'),
    exerciseCount: number('exercise_count'),
    formatVersion: number('format_version'),
  };
}
