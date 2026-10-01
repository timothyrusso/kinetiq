import { Schema } from 'effect';

/** One entry of a taxonomy: a body area, a piece of equipment or a muscle, by its dataset key. */
const TaxonSchema = Schema.Struct({ id: Schema.String, name: Schema.String });

export type Taxon = typeof TaxonSchema.Type;

/** The filter vocabulary: a few dozen rows that change only with the catalog. */
const ExerciseTaxonomySchema = Schema.Struct({
  bodyAreas: Schema.Array(TaxonSchema),
  equipment: Schema.Array(TaxonSchema),
  muscles: Schema.Array(TaxonSchema),
});

export type ExerciseTaxonomy = typeof ExerciseTaxonomySchema.Type;
