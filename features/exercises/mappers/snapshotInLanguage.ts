import type { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { storedTaxonName } from '@/features/exercises/mappers/taxonNames';

/**
 * `snapshot` with its category, muscles and equipment named in `language`, so a routine item picked
 * in one language follows the app into another. The stored row is left as it was written, and the
 * exercise name keeps the language it was picked in: wger names exercises per language, and the
 * snapshot holds one.
 */
export function snapshotInLanguage(snapshot: ExerciseSnapshot, language: CatalogLanguage): ExerciseSnapshot {
  const muscle = (name: string) => storedTaxonName('muscle', name, language);
  return {
    ...snapshot,
    category: snapshot.category === null ? null : storedTaxonName('category', snapshot.category, language),
    primaryMuscles: snapshot.primaryMuscles.map(muscle),
    secondaryMuscles: snapshot.secondaryMuscles.map(muscle),
    equipment: snapshot.equipment.map(name => storedTaxonName('equipment', name, language)),
  };
}
