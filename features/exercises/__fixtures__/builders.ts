import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';
import type { CatalogExercise, CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import { ExerciseId } from '@/features/exercises/domain/schemas/ExerciseId';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';

type Names = { readonly en: string; readonly it?: string };

/**
 * A dataset entry `ex:<slug>`, named in English and, when given, Italian (else the English name
 * again, as an untranslated entry would be), each with its own steps.
 */
export const aCatalogExercise = (
  slug = 'barbell-bench-press',
  names: Names = { en: 'Barbell Bench Press', it: 'Panca piana con bilanciere' },
  overrides: Partial<CatalogExercise> = {},
): CatalogExercise => ({
  id: ExerciseId.make(`ex:${slug}`),
  name: { en: names.en, it: names.it ?? names.en },
  instructions: { en: [`${names.en}, step one`, 'Then press.'], it: [`${names.it ?? names.en}, primo passo`] },
  bodyArea: 'chest',
  trainingType: 'strength',
  level: 'beginner',
  force: 'push',
  mechanic: 'compound',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  equipment: 'barbell',
  images: { start: `images/${slug}/0.webp`, end: `images/${slug}/1.webp`, thumb: `images/${slug}/thumb.webp` },
  ...overrides,
});

/** A dataset of `exercises` at `datasetVersion` 1. */
export const aCatalogPayload = (
  exercises: readonly CatalogExercise[] = [aCatalogExercise()],
  overrides: Partial<CatalogPayload> = {},
): CatalogPayload => ({ datasetVersion: 1, exercises, ...overrides });

/** An exercise as the catalog reads it back. */
export const anExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'ex:barbell-bench-press',
  name: 'Barbell Bench Press',
  instructions: ['Lower the bar to the chest, then press.'],
  category: 'Chest',
  bodyArea: 'chest',
  trainingType: 'strength',
  level: 'beginner',
  force: 'push',
  mechanic: 'compound',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps'],
  equipment: ['Barbell'],
  imageUrl: null,
  imageEndUrl: null,
  thumbnailUrl: null,
  source: 'catalog',
  ...overrides,
});

/** The meta of the bundled dataset at version 1, installed at 5 000. */
export const aCatalogMeta = (overrides: Partial<CatalogMeta> = {}): CatalogMeta => ({
  datasetVersion: 1,
  installedAt: 5_000,
  exerciseCount: 1,
  formatVersion: 2,
  ...overrides,
});
