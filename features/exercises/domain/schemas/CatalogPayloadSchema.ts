import { Schema } from 'effect';
import { ExerciseId } from '@/features/exercises/domain/schemas/ExerciseId';

const CatalogTranslationSchema = Schema.Struct({
  name: Schema.String,
  instructions: Schema.NullOr(Schema.String),
});

const NamedTaxonSchema = Schema.Struct({ id: Schema.Number, name: Schema.String });

/** One exercise as the catalog stores it: ids into the taxonomy, and a translation per language. */
const CatalogExerciseSchema = Schema.Struct({
  id: ExerciseId,
  externalId: Schema.Number,
  uuid: Schema.NullOr(Schema.String),
  // NOTE: wger's variation uuid; exercises sharing one are variations of each other.
  variationGroup: Schema.NullOr(Schema.String),
  categoryId: Schema.Number,
  primaryMuscleIds: Schema.Array(Schema.Number),
  secondaryMuscleIds: Schema.Array(Schema.Number),
  equipmentIds: Schema.Array(Schema.Number),
  imageUrl: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  videoUrl: Schema.NullOr(Schema.String),
  translations: Schema.Struct({
    en: Schema.optional(CatalogTranslationSchema),
    it: Schema.optional(CatalogTranslationSchema),
  }),
});

export type CatalogExercise = typeof CatalogExerciseSchema.Type;

/**
 * The one shape the exercise catalog travels in, format version 1.
 *
 * The bundled snapshot and the network download both produce a `CatalogPayload`, and both go
 * through `replaceCatalog`, the only writer of the catalog tables: two sources, one write path,
 * so a bug in the swap cannot hide in whichever source was not tested. Only English and Italian
 * are kept, and nothing here is derived for display.
 */
export const CatalogPayloadSchema = Schema.Struct({
  formatVersion: Schema.Literal(1),
  source: Schema.Literal('wger'),
  // NOTE: epoch ms: when the payload was fetched from wger.
  generatedAt: Schema.Number,
  categories: Schema.Array(NamedTaxonSchema),
  equipment: Schema.Array(NamedTaxonSchema),
  muscles: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      nameEn: Schema.NullOr(Schema.String),
      isFront: Schema.Boolean,
    }),
  ),
  exercises: Schema.Array(CatalogExerciseSchema),
});

export type CatalogPayload = typeof CatalogPayloadSchema.Type;
