import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';
import type { CatalogExercise, CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { remoteExerciseId } from '@/features/exercises/domain/utils/exerciseId';

type Names = { readonly en?: string; readonly it?: string };

/** A catalog row named in the given languages, each with its own instructions. */
export const aCatalogExercise = (
  externalId = 10,
  names: Names = { en: 'Bench Press', it: 'Panca piana' },
  overrides: Partial<CatalogExercise> = {},
): CatalogExercise => ({
  id: remoteExerciseId(externalId),
  externalId,
  uuid: null,
  variationGroup: null,
  categoryId: 1,
  primaryMuscleIds: [],
  secondaryMuscleIds: [],
  equipmentIds: [],
  imageUrl: null,
  thumbnailUrl: null,
  videoUrl: null,
  translations: {
    ...(names.en === undefined ? {} : { en: { name: names.en, instructions: `${names.en}, how` } }),
    ...(names.it === undefined ? {} : { it: { name: names.it, instructions: `${names.it}, come` } }),
  },
  ...overrides,
});

/** A payload over a small taxonomy: two categories, two pieces of equipment, three muscles. */
export const aCatalogPayload = (
  exercises: readonly CatalogExercise[] = [aCatalogExercise()],
  overrides: Partial<CatalogPayload> = {},
): CatalogPayload => ({
  formatVersion: 1,
  source: 'wger',
  generatedAt: 1_000,
  categories: [
    { id: 1, name: 'Chest' },
    { id: 2, name: 'Legs' },
  ],
  equipment: [
    { id: 1, name: 'Barbell' },
    { id: 2, name: 'Dumbbell' },
  ],
  muscles: [
    { id: 1, name: 'Pectoralis major', nameEn: 'Chest', isFront: true },
    { id: 2, name: 'Triceps brachii', nameEn: '', isFront: false },
    { id: 3, name: 'Quadriceps femoris', nameEn: 'Quads', isFront: true },
  ],
  exercises,
  ...overrides,
});

/** An exercise as the catalog reads it back. */
export const anExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'wger:10',
  name: 'Bench Press',
  instructions: 'Lower the bar to the chest, then press.',
  category: 'Chest',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps brachii'],
  equipment: ['Barbell'],
  imageUrl: null,
  thumbnailUrl: null,
  videoUrl: null,
  source: 'remote',
  externalId: 10,
  ...overrides,
});

/** The meta of a catalog installed from a snapshot generated at `generatedAt`. */
export const aCatalogMeta = (overrides: Partial<CatalogMeta> = {}): CatalogMeta => ({
  source: 'wger',
  generatedAt: 1_000,
  installedAt: 5_000,
  refreshedAt: null,
  exerciseCount: 1,
  formatVersion: 1,
  ...overrides,
});
