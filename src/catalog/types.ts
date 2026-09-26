/**
 * The one shape the exercise catalog travels in.
 *
 * The bundled snapshot and the network download both produce a `CatalogPayload`, and both go
 * through `replaceCatalog`, which is the only writer of the catalog tables. Two sources, one
 * write path: a bug in the swap cannot hide in whichever source was not tested.
 *
 * Only English and Italian are kept, because those are the app's two languages. The payload is
 * wger's data trimmed to what the app reads; nothing here is derived for display.
 */

export type CatalogLanguage = 'en' | 'it';

type CatalogTranslation = { name: string; instructions: string | null };

export type CatalogExercise = {
  /** `wger:<n>`, the same namespace as `src/domain/exerciseId.ts`. */
  id: string;
  externalId: number;
  uuid: string | null;
  /** wger's variation uuid; exercises sharing one are variations of each other. */
  variationGroup: string | null;
  categoryId: number;
  primaryMuscleIds: number[];
  secondaryMuscleIds: number[];
  equipmentIds: number[];
  imageUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  translations: Partial<Record<CatalogLanguage, CatalogTranslation>>;
};

export type CatalogPayload = {
  formatVersion: 1;
  source: 'wger';
  /** Epoch ms: when the payload was fetched from wger. */
  generatedAt: number;
  categories: { id: number; name: string }[];
  equipment: { id: number; name: string }[];
  muscles: { id: number; name: string; nameEn: string | null; isFront: boolean }[];
  exercises: CatalogExercise[];
};

/** What `catalog_meta` says about the installed catalog. Null fields were never written. */
export type CatalogMeta = {
  source: string | null;
  generatedAt: number | null;
  installedAt: number | null;
  refreshedAt: number | null;
  exerciseCount: number | null;
  formatVersion: number | null;
};
