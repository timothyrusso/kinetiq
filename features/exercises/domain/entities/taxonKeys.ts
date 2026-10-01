import type {
  BodyArea,
  Equipment,
  LEVELS,
  MECHANICS,
  Muscle,
  TRAINING_TYPES,
} from '@/features/exercises/domain/entities/catalogTaxonomy';

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

/**
 * The catalog key naming each badge value the detail shows: what kind of training an exercise is,
 * how hard it is to learn and whether it works one joint or several. Labels only: nothing filters
 * on them.
 */
export const BADGE_KEYS = {
  trainingType: {
    strength: 'exerciseTrainingTypes.strength',
    stretching: 'exerciseTrainingTypes.stretching',
    plyometrics: 'exerciseTrainingTypes.plyometrics',
    strongman: 'exerciseTrainingTypes.strongman',
    powerlifting: 'exerciseTrainingTypes.powerlifting',
    cardio: 'exerciseTrainingTypes.cardio',
    'olympic weightlifting': 'exerciseTrainingTypes.olympicWeightlifting',
  },
  level: {
    beginner: 'exerciseLevels.beginner',
    intermediate: 'exerciseLevels.intermediate',
    expert: 'exerciseLevels.expert',
  },
  mechanic: {
    compound: 'exerciseMechanics.compound',
    isolation: 'exerciseMechanics.isolation',
  },
} as const satisfies {
  trainingType: Record<(typeof TRAINING_TYPES)[number], string>;
  level: Record<(typeof LEVELS)[number], string>;
  mechanic: Record<(typeof MECHANICS)[number], string>;
};
