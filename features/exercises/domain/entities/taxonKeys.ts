/** One of wger's three taxonomies. */
export type TaxonKind = 'category' | 'equipment' | 'muscle';

const CATEGORY = [
  [8, 'exerciseCategories.arms'],
  [9, 'exerciseCategories.legs'],
  [10, 'exerciseCategories.abs'],
  [11, 'exerciseCategories.chest'],
  [12, 'exerciseCategories.back'],
  [13, 'exerciseCategories.shoulders'],
  [14, 'exerciseCategories.calves'],
  [15, 'exerciseCategories.cardio'],
] as const;

const EQUIPMENT = [
  [1, 'exerciseEquipment.barbell'],
  [2, 'exerciseEquipment.szBar'],
  [3, 'exerciseEquipment.dumbbell'],
  [4, 'exerciseEquipment.gymMat'],
  [5, 'exerciseEquipment.swissBall'],
  [6, 'exerciseEquipment.pullUpBar'],
  [7, 'exerciseEquipment.bodyweight'],
  [8, 'exerciseEquipment.bench'],
  [9, 'exerciseEquipment.inclineBench'],
  [10, 'exerciseEquipment.kettlebell'],
  [11, 'exerciseEquipment.resistanceBand'],
  [12, 'exerciseEquipment.cableMachine'],
] as const;

const MUSCLE = [
  [1, 'exerciseMuscles.biceps'],
  [2, 'exerciseMuscles.shoulders'],
  [3, 'exerciseMuscles.serratus'],
  [4, 'exerciseMuscles.chest'],
  [5, 'exerciseMuscles.triceps'],
  [6, 'exerciseMuscles.abs'],
  [7, 'exerciseMuscles.calves'],
  [8, 'exerciseMuscles.glutes'],
  [9, 'exerciseMuscles.trapezius'],
  [10, 'exerciseMuscles.quads'],
  [11, 'exerciseMuscles.hamstrings'],
  [12, 'exerciseMuscles.lats'],
  [13, 'exerciseMuscles.brachialis'],
  [14, 'exerciseMuscles.obliques'],
  [15, 'exerciseMuscles.soleus'],
] as const;

/** The catalog key naming a wger taxon: a key of the app's translation catalog. */
export type TaxonKey = (typeof CATEGORY)[number][1] | (typeof EQUIPMENT)[number][1] | (typeof MUSCLE)[number][1];

/**
 * The catalog key naming each wger taxon, by wger's id. wger names its taxonomy in English (and
 * muscles in Latin) only, so the app names the ones it knows in its own catalog; the ids are stable
 * across catalog refreshes, the English names are not.
 */
export const TAXON_KEYS: Record<TaxonKind, ReadonlyMap<number, TaxonKey>> = {
  category: new Map<number, TaxonKey>(CATEGORY),
  equipment: new Map<number, TaxonKey>(EQUIPMENT),
  muscle: new Map<number, TaxonKey>(MUSCLE),
};
