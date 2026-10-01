import type { BodyArea, Equipment, Muscle } from '@/features/exercises/domain/entities/catalogTaxonomy';

/** One of the catalog's three filterable taxonomies. */
export type TaxonKind = 'bodyArea' | 'equipment' | 'muscle';

const BODY_AREA = {
  arms: 'exerciseCategories.arms',
  legs: 'exerciseCategories.legs',
  abs: 'exerciseCategories.abs',
  chest: 'exerciseCategories.chest',
  back: 'exerciseCategories.back',
  shoulders: 'exerciseCategories.shoulders',
  calves: 'exerciseCategories.calves',
  cardio: 'exerciseCategories.cardio',
} as const satisfies Record<BodyArea, string>;

const MUSCLE = {
  abdominals: 'exerciseMuscles.abdominals',
  biceps: 'exerciseMuscles.biceps',
  triceps: 'exerciseMuscles.triceps',
  forearms: 'exerciseMuscles.forearms',
  chest: 'exerciseMuscles.chest',
  lats: 'exerciseMuscles.lats',
  'middle-back': 'exerciseMuscles.middleBack',
  'lower-back': 'exerciseMuscles.lowerBack',
  traps: 'exerciseMuscles.traps',
  shoulders: 'exerciseMuscles.shoulders',
  neck: 'exerciseMuscles.neck',
  quadriceps: 'exerciseMuscles.quadriceps',
  hamstrings: 'exerciseMuscles.hamstrings',
  glutes: 'exerciseMuscles.glutes',
  adductors: 'exerciseMuscles.adductors',
  abductors: 'exerciseMuscles.abductors',
  calves: 'exerciseMuscles.calves',
} as const satisfies Record<Muscle, string>;

const EQUIPMENT = {
  'body-only': 'exerciseEquipment.bodyOnly',
  machine: 'exerciseEquipment.machine',
  other: 'exerciseEquipment.other',
  'foam-roll': 'exerciseEquipment.foamRoll',
  kettlebell: 'exerciseEquipment.kettlebell',
  dumbbell: 'exerciseEquipment.dumbbell',
  cable: 'exerciseEquipment.cable',
  barbell: 'exerciseEquipment.barbell',
  band: 'exerciseEquipment.band',
  'medicine-ball': 'exerciseEquipment.medicineBall',
  'exercise-ball': 'exerciseEquipment.exerciseBall',
  'ez-bar': 'exerciseEquipment.ezBar',
} as const satisfies Record<Equipment, string>;

/** The catalog key naming a taxon: a key of the app's translation catalog. */
export type TaxonKey = (typeof BODY_AREA)[BodyArea] | (typeof MUSCLE)[Muscle] | (typeof EQUIPMENT)[Equipment];

/**
 * The translation catalog key naming each taxon, by the dataset's own key. The dataset names
 * nothing for display: every label is the app's, in every language it speaks.
 */
export const TAXON_KEYS: Record<TaxonKind, ReadonlyMap<string, TaxonKey>> = {
  bodyArea: new Map<string, TaxonKey>(Object.entries(BODY_AREA)),
  equipment: new Map<string, TaxonKey>(Object.entries(EQUIPMENT)),
  muscle: new Map<string, TaxonKey>(Object.entries(MUSCLE)),
};
