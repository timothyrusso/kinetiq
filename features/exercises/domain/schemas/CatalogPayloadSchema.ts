import { Schema } from 'effect';
import {
  BODY_AREAS,
  EQUIPMENT,
  FORCES,
  LEVELS,
  MECHANICS,
  MUSCLES,
  TRAINING_TYPES,
} from '@/features/exercises/domain/entities/catalogTaxonomy';
import { ExerciseId } from '@/features/exercises/domain/schemas/ExerciseId';

/** The format `CatalogPayloadSchema` reads, stamped in `catalog_meta` with every install. */
export const CATALOG_FORMAT_VERSION = 2;

const Muscle = Schema.Literal(...MUSCLES);

/** A text per catalog language: the dataset writes every exercise in both. */
const PerLanguage = <A, I>(value: Schema.Schema<A, I>) => Schema.Struct({ en: value, it: value });

/** One exercise as `exercises.json` holds it: text keys into the vocabularies, and both languages. */
const CatalogExerciseSchema = Schema.Struct({
  id: ExerciseId,
  name: PerLanguage(Schema.String),
  // NOTE: the steps in order, one sentence or two each; empty when the dataset has none.
  instructions: PerLanguage(Schema.Array(Schema.String)),
  bodyArea: Schema.Literal(...BODY_AREAS),
  trainingType: Schema.Literal(...TRAINING_TYPES),
  level: Schema.Literal(...LEVELS),
  force: Schema.NullOr(Schema.Literal(...FORCES)),
  mechanic: Schema.NullOr(Schema.Literal(...MECHANICS)),
  primaryMuscles: Schema.Array(Muscle),
  secondaryMuscles: Schema.Array(Muscle),
  equipment: Schema.Literal(...EQUIPMENT),
  // NOTE: paths relative to `assets/catalog`; an exercise in `pendingPhotos.json` names files
  // that are not there yet.
  images: Schema.Struct({ start: Schema.String, end: Schema.String, thumb: Schema.String }),
});

export type CatalogExercise = typeof CatalogExerciseSchema.Type;

/**
 * The shape the exercise catalog travels in, format version 2: `assets/catalog/exercises.json`
 * as committed. `datasetVersion` goes up with every edit of the dataset, and is what tells an
 * installed catalog it is out of date. `replaceCatalog` is the only writer of the catalog tables.
 */
export const CatalogPayloadSchema = Schema.Struct({
  datasetVersion: Schema.Int.pipe(Schema.positive()),
  exercises: Schema.Array(CatalogExerciseSchema),
});

export type CatalogPayload = typeof CatalogPayloadSchema.Type;

/** `assets/catalog/version.json`: the bundled dataset's version alone, a few bytes to read. */
export const CatalogVersionSchema = Schema.Struct({ datasetVersion: CatalogPayloadSchema.fields.datasetVersion });
