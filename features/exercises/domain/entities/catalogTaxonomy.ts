/**
 * The dataset's vocabularies, as `assets/catalog/exercises.json` spells them. Every value is a
 * stable text key: the dataset is edited by hand, and a key is what the filters, the junction
 * tables and the app's translation catalog agree on.
 */

/** The eight areas the catalog groups exercises by: cardio, else the first primary muscle's. */
export const BODY_AREAS = ['arms', 'legs', 'abs', 'chest', 'back', 'shoulders', 'calves', 'cardio'] as const;

export type BodyArea = (typeof BODY_AREAS)[number];

/** One key per anatomical region, ready for a body map. */
export const MUSCLES = [
  'abdominals',
  'biceps',
  'triceps',
  'forearms',
  'chest',
  'lats',
  'middle-back',
  'lower-back',
  'traps',
  'shoulders',
  'neck',
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
] as const;

export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  'body-only',
  'machine',
  'other',
  'foam-roll',
  'kettlebell',
  'dumbbell',
  'cable',
  'barbell',
  'band',
  'medicine-ball',
  'exercise-ball',
  'ez-bar',
  'suspension',
  'rings',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

/** What kind of training an exercise is; kept so cardio can later be tracked by time. */
export const TRAINING_TYPES = [
  'strength',
  'stretching',
  'plyometrics',
  'strongman',
  'powerlifting',
  'cardio',
  'olympic weightlifting',
] as const;

export const LEVELS = ['beginner', 'intermediate', 'expert'] as const;

export const FORCES = ['pull', 'push', 'static'] as const;

export const MECHANICS = ['compound', 'isolation'] as const;
