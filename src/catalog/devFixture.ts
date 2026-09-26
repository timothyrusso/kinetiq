/**
 * Temporary: a hand-written catalog for development builds, until the bundled snapshot lands
 * (#39, PR 3), which deletes this file.
 *
 * Small on purpose, but it covers each path the local provider has: both languages, an
 * exercise with only an English name, a variation group, and every filter. The external ids are
 * in a range wger does not use, so nothing mistakes a fixture row for a real one.
 */
import { remoteExerciseId } from '@/domain/exerciseId';
import { readCatalogMeta, replaceCatalog } from './repository';
import type { CatalogExercise, CatalogPayload } from './types';

const PRESS = 'fixture-press';
const SQUAT = 'fixture-squat';

function exercise(
  externalId: number,
  en: string,
  it: string | null,
  fields: Pick<CatalogExercise, 'categoryId' | 'primaryMuscleIds' | 'secondaryMuscleIds' | 'equipmentIds'> & {
    variationGroup?: string;
  },
): CatalogExercise {
  return {
    id: remoteExerciseId(externalId),
    externalId,
    uuid: null,
    variationGroup: fields.variationGroup ?? null,
    categoryId: fields.categoryId,
    primaryMuscleIds: fields.primaryMuscleIds,
    secondaryMuscleIds: fields.secondaryMuscleIds,
    equipmentIds: fields.equipmentIds,
    imageUrl: null,
    thumbnailUrl: null,
    videoUrl: null,
    translations: {
      en: { name: en, instructions: `Fixture instructions for ${en}.` },
      ...(it === null ? {} : { it: { name: it, instructions: `Istruzioni di prova per ${it}.` } }),
    },
  };
}

const FIXTURE: CatalogPayload = {
  formatVersion: 1,
  source: 'wger',
  generatedAt: Date.UTC(2026, 8, 26),
  categories: [
    { id: 1, name: 'Chest' },
    { id: 2, name: 'Legs' },
    { id: 3, name: 'Back' },
  ],
  equipment: [
    { id: 1, name: 'Barbell' },
    { id: 2, name: 'Dumbbell' },
    { id: 3, name: 'none (bodyweight exercise)' },
  ],
  muscles: [
    { id: 1, name: 'Pectoralis major', nameEn: 'Chest', isFront: true },
    { id: 2, name: 'Quadriceps femoris', nameEn: 'Quads', isFront: true },
    { id: 3, name: 'Latissimus dorsi', nameEn: 'Lats', isFront: false },
    { id: 4, name: 'Triceps brachii', nameEn: 'Triceps', isFront: false },
  ],
  exercises: [
    exercise(990001, 'Bench Press', 'Panca piana', {
      categoryId: 1, primaryMuscleIds: [1], secondaryMuscleIds: [4], equipmentIds: [1], variationGroup: PRESS,
    }),
    exercise(990002, 'Dumbbell Bench Press', 'Panca piana con manubri', {
      categoryId: 1, primaryMuscleIds: [1], secondaryMuscleIds: [4], equipmentIds: [2], variationGroup: PRESS,
    }),
    exercise(990003, 'Push-Up', 'Piegamenti', {
      categoryId: 1, primaryMuscleIds: [1], secondaryMuscleIds: [4], equipmentIds: [3],
    }),
    exercise(990004, 'Back Squat', 'Squat con bilanciere', {
      categoryId: 2, primaryMuscleIds: [2], secondaryMuscleIds: [], equipmentIds: [1], variationGroup: SQUAT,
    }),
    exercise(990005, 'Goblet Squat', 'Goblet squat', {
      categoryId: 2, primaryMuscleIds: [2], secondaryMuscleIds: [], equipmentIds: [2], variationGroup: SQUAT,
    }),
    exercise(990006, 'Pull-Up', 'Trazioni alla sbarra', {
      categoryId: 3, primaryMuscleIds: [3], secondaryMuscleIds: [], equipmentIds: [3],
    }),
    exercise(990007, 'Bent-Over Row', null, {
      categoryId: 3, primaryMuscleIds: [3], secondaryMuscleIds: [], equipmentIds: [1],
    }),
  ],
};

/** Installs the fixture when no catalog has ever been installed. */
export async function loadDevCatalogFixture(): Promise<void> {
  const meta = await readCatalogMeta();
  if (meta.installedAt === null) await replaceCatalog(FIXTURE, 'install');
}
