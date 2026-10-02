import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The bundled dataset in `assets/catalog`, read from disk. Every expectation is derived from
 * `exercises.json`, so adding or editing an entry never touches these tests.
 */
interface DatasetExercise {
  id: string;
  name: { en: string; it: string };
  instructions: { en: string[]; it: string[] };
  bodyArea: string;
  trainingType: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  images: { start: string; end: string; thumb: string };
}

interface Index {
  fields: string[];
  exercises: [string, string, string[], string][];
}

const CATALOG = resolve(__dirname, '../../../../assets/catalog');
const read = (name: string) => JSON.parse(readFileSync(resolve(CATALOG, name), 'utf8'));

const dataset: { datasetVersion: number; exercises: DatasetExercise[] } = read('exercises.json');
const version: { datasetVersion: number } = read('version.json');
const index: Index = read('index.json');
const pendingPhotos: string[] = read('pendingPhotos.json');
const { exercises } = dataset;

const MUSCLE_AREA: Record<string, string> = {
  abdominals: 'abs',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  chest: 'chest',
  lats: 'back',
  'middle-back': 'back',
  'lower-back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  neck: 'shoulders',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  calves: 'calves',
};

const EQUIPMENT = new Set([
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
]);

/** The body area rule: cardio wins, then the first primary muscle, then the first secondary, then abs. */
const bodyAreaOf = ({ primaryMuscles, secondaryMuscles, trainingType }: DatasetExercise) => {
  if (trainingType === 'cardio') return 'cardio';
  const muscle = primaryMuscles[0] ?? secondaryMuscles[0];
  return muscle === undefined ? 'abs' : MUSCLE_AREA[muscle];
};

const photosOf = ({ images }: DatasetExercise) => [images.start, images.end, images.thumb];
const hasPhotos = (exercise: DatasetExercise) => photosOf(exercise).some(path => existsSync(resolve(CATALOG, path)));

describe('the bundled exercise dataset', () => {
  it('repeats the content version of version.json', () => {
    expect(dataset.datasetVersion).toBe(version.datasetVersion);
  });

  it('has unique ex: ids', () => {
    const ids = exercises.map(exercise => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^ex:[a-z0-9-]+$/);
  });

  it('uses only known muscle and equipment keys', () => {
    const unknown = exercises.flatMap(({ id, primaryMuscles, secondaryMuscles, equipment }) => [
      ...[...primaryMuscles, ...secondaryMuscles]
        .filter(muscle => !(muscle in MUSCLE_AREA))
        .map(key => `${id}: ${key}`),
      ...(EQUIPMENT.has(equipment) ? [] : [`${id}: ${equipment}`]),
    ]);
    expect(unknown).toEqual([]);
  });

  it('derives every body area from the muscles and the training type', () => {
    const wrong = exercises
      .filter(exercise => exercise.bodyArea !== bodyAreaOf(exercise))
      .map(exercise => `${exercise.id}: ${exercise.bodyArea}, rule says ${bodyAreaOf(exercise)}`);
    expect(wrong).toEqual([]);
  });

  it('bundles both frames and the thumbnail of every exercise not pending photos', () => {
    const pending = new Set(pendingPhotos);
    const missing = exercises
      .filter(exercise => !pending.has(exercise.id))
      .flatMap(photosOf)
      .filter(path => !existsSync(resolve(CATALOG, path)));
    expect(missing).toEqual([]);
  });

  it('lists as pending only catalog exercises that have no photos yet', () => {
    const ids = new Set(exercises.map(exercise => exercise.id));
    expect(pendingPhotos.filter(id => !ids.has(id))).toEqual([]);
    expect(exercises.filter(exercise => pendingPhotos.includes(exercise.id) && hasPhotos(exercise))).toEqual([]);
  });

  it('has an index that matches the dataset', () => {
    expect(index.fields).toEqual(['id', 'name', 'primaryMuscles', 'equipment']);
    expect(index.exercises).toEqual(
      exercises.map(exercise => [exercise.id, exercise.name.en, exercise.primaryMuscles, exercise.equipment]),
    );
  });

  it('has Italian instructions, different from the English ones, wherever there are English ones', () => {
    const untranslated = exercises
      .filter(({ instructions }) => instructions.en.length > 0)
      .filter(({ instructions }) => instructions.it.length === 0 || instructions.it.join() === instructions.en.join())
      .map(exercise => exercise.id);
    expect(untranslated).toEqual([]);
  });

  it('names every exercise in both languages', () => {
    expect(exercises.filter(({ name }) => name.en.trim() === '' || name.it.trim() === '').map(({ id }) => id)).toEqual(
      [],
    );
  });
});
