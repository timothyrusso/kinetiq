import type { ExerciseFilter } from '@/domain/types';
import {
  catalogById,
  catalogPage,
  catalogTaxonomy,
  catalogVariations,
  readCatalogMeta,
  replaceCatalog,
} from '../repository';
import type { CatalogExercise, CatalogPayload } from '../types';
import { createMemoryDatabase, type MemoryDatabase } from './memoryDatabase';

let mockDb: MemoryDatabase;

jest.mock('@/persistence/database', () => ({
  getDatabase: () => mockDb,
}));

const ALL: ExerciseFilter = { query: '', categoryId: null, equipmentId: null, muscleId: null };

function exercise(
  externalId: number,
  names: { en?: string; it?: string },
  fields: Partial<CatalogExercise> = {},
): CatalogExercise {
  return {
    id: `wger:${externalId}`,
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
    ...fields,
  };
}

function payload(exercises: CatalogExercise[]): CatalogPayload {
  return {
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
  };
}

const BENCH = exercise(
  10,
  { en: 'Bench Press', it: 'Panca piana' },
  { primaryMuscleIds: [1], secondaryMuscleIds: [2], equipmentIds: [1], variationGroup: 'press', imageUrl: 'big.png' },
);
const DUMBBELL_BENCH = exercise(
  11,
  { en: 'Dumbbell Bench Press', it: 'Distensioni su panca' },
  { primaryMuscleIds: [1], equipmentIds: [2], variationGroup: 'press' },
);
const DIP = exercise(12, { en: 'Dips' }, { primaryMuscleIds: [2], secondaryMuscleIds: [1] });
const SQUAT = exercise(13, { en: 'Squat', it: 'Squat con bilanciere' }, { categoryId: 2, primaryMuscleIds: [3], equipmentIds: [1] });
const GERMAN_ONLY = exercise(14, {});
const PERCENT = exercise(15, { en: '100% effort row' });

beforeEach(async () => {
  mockDb = createMemoryDatabase();
  await replaceCatalog(payload([BENCH, DUMBBELL_BENCH, DIP, SQUAT, GERMAN_ONLY, PERCENT]), 'install', 5_000);
});

describe('replaceCatalog', () => {
  it('stamps the meta for an install', async () => {
    await expect(readCatalogMeta()).resolves.toEqual({
      source: 'wger',
      generatedAt: 1_000,
      installedAt: 5_000,
      refreshedAt: null,
      exerciseCount: 6,
      formatVersion: 1,
    });
  });

  it('replaces every row on refresh and keeps the install date', async () => {
    await replaceCatalog({ ...payload([SQUAT]), generatedAt: 2_000 }, 'refresh', 9_000);

    expect(mockDb.count('catalog_exercises')).toBe(1);
    expect(mockDb.count('catalog_translations')).toBe(2);
    expect(mockDb.count('catalog_exercise_muscles')).toBe(1);
    await expect(catalogById(10, 'en')).resolves.toBeNull();
    await expect(readCatalogMeta()).resolves.toMatchObject({
      generatedAt: 2_000,
      installedAt: 5_000,
      refreshedAt: 9_000,
      exerciseCount: 1,
    });
  });

  it('leaves the previous catalog untouched when the write fails', async () => {
    // Two rows with one id: the primary key rejects the insert after the delete has run.
    await expect(replaceCatalog(payload([SQUAT, SQUAT]), 'refresh', 9_000)).rejects.toThrow();

    expect(mockDb.count('catalog_exercises')).toBe(6);
    await expect(catalogById(10, 'en')).resolves.toMatchObject({ name: 'Bench Press' });
    await expect(readCatalogMeta()).resolves.toMatchObject({ refreshedAt: null, exerciseCount: 6 });
  });

  it('writes more rows than one statement can bind', async () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      exercise(1_000 + i, { en: `Move ${i}`, it: `Mossa ${i}` }, { primaryMuscleIds: [1, 3], equipmentIds: [1] }),
    );
    await replaceCatalog(payload(many), 'refresh', 9_000);

    expect(mockDb.count('catalog_translations')).toBe(800);
    expect(mockDb.count('catalog_exercise_muscles')).toBe(800);
  });
});

describe('catalogPage', () => {
  it('names rows in the render language, falls back to English, and skips rows with neither', async () => {
    const { items, total } = await catalogPage(ALL, 'it', 0, 50);

    expect(items.map((e) => e.name)).toEqual([
      '100% effort row',
      'Dips',
      'Distensioni su panca',
      'Panca piana',
      'Squat con bilanciere',
    ]);
    expect(total).toBe(5);
  });

  it('matches the search term in either language, ignoring case and accents', async () => {
    const italian = await catalogPage({ ...ALL, query: 'PANCA' }, 'it', 0, 50);
    expect(italian.items.map((e) => e.externalId)).toEqual([10, 11]);

    const english = await catalogPage({ ...ALL, query: 'bench' }, 'it', 0, 50);
    expect(english.items.map((e) => e.externalId)).toEqual([10, 11]);

    const accented = await catalogPage({ ...ALL, query: 'pànca  piana' }, 'it', 0, 50);
    expect(accented.items.map((e) => e.externalId)).toEqual([10]);
  });

  it('ranks a whole-name match, then a name prefix, then a word prefix, then the rest', async () => {
    await replaceCatalog(
      payload([
        exercise(20, { en: '1 Leg Box Squat' }),
        exercise(21, { en: 'Squatting Hold' }),
        exercise(22, { en: 'Squat' }),
        exercise(23, { en: 'Box Squat', it: 'Squat box' }),
        exercise(24, { en: 'Backsquat' }),
      ]),
      'refresh',
      9_000,
    );

    // Rendering in Italian: 23 is a name prefix there ("Squat box"), which outranks 21's
    // English-only prefix, and both outrank the word-start match in 20.
    const { items } = await catalogPage({ ...ALL, query: 'squat' }, 'it', 0, 50);
    expect(items.map((e) => e.externalId)).toEqual([22, 23, 21, 20, 24]);

    const english = await catalogPage({ ...ALL, query: 'squat' }, 'en', 0, 50);
    expect(english.items.map((e) => e.externalId)).toEqual([22, 21, 20, 23, 24]);
  });

  it('puts a prefix in the render language ahead of one in English only', async () => {
    await replaceCatalog(
      payload([
        exercise(30, { en: 'Squat Thrust', it: 'Spinte squat' }),
        exercise(31, { en: 'Squats', it: 'Squat (stacchi)' }),
      ]),
      'refresh',
      9_000,
    );

    // "Spinte squat" sorts first by name, but only its English name starts with the term.
    const { items } = await catalogPage({ ...ALL, query: 'squat' }, 'it', 0, 50);
    expect(items.map((e) => e.externalId)).toEqual([31, 30]);
  });

  it('treats % and _ in the term as text', async () => {
    const { items } = await catalogPage({ ...ALL, query: '100%' }, 'en', 0, 50);
    expect(items.map((e) => e.externalId)).toEqual([15]);

    await expect(catalogPage({ ...ALL, query: '%' }, 'en', 0, 50)).resolves.toMatchObject({ total: 1 });
    await expect(catalogPage({ ...ALL, query: '_' }, 'en', 0, 50)).resolves.toMatchObject({ total: 0 });
  });

  it('filters by category, equipment and primary muscle', async () => {
    const legs = await catalogPage({ ...ALL, categoryId: 2 }, 'en', 0, 50);
    expect(legs.items.map((e) => e.externalId)).toEqual([13]);

    const barbell = await catalogPage({ ...ALL, equipmentId: 1 }, 'en', 0, 50);
    expect(barbell.items.map((e) => e.externalId)).toEqual([10, 13]);

    // Dips work the chest only as a secondary muscle, so the chest filter leaves them out.
    const chest = await catalogPage({ ...ALL, muscleId: 1 }, 'en', 0, 50);
    expect(chest.items.map((e) => e.externalId)).toEqual([10, 11]);
  });

  it('pages by offset and reports the filtered total', async () => {
    const first = await catalogPage(ALL, 'en', 0, 2);
    const second = await catalogPage(ALL, 'en', 2, 2);

    expect(first.items.map((e) => e.name)).toEqual(['100% effort row', 'Bench Press']);
    expect(second.items.map((e) => e.name)).toEqual(['Dips', 'Dumbbell Bench Press']);
    expect(second.total).toBe(5);
  });
});

describe('catalogById', () => {
  it('returns the full row with muscle and equipment names', async () => {
    await expect(catalogById(10, 'it')).resolves.toEqual({
      id: 'wger:10',
      name: 'Panca piana',
      instructions: 'Panca piana, come',
      category: 'Chest',
      primaryMuscles: ['Chest'],
      // No common name for this muscle, so the Latin one stands.
      secondaryMuscles: ['Triceps brachii'],
      equipment: ['Barbell'],
      imageUrl: 'big.png',
      thumbnailUrl: 'big.png',
      videoUrl: null,
      source: 'remote',
      externalId: 10,
    });
  });

  it('names a row with no English or Italian translation by its id, and returns null for a missing id', async () => {
    await expect(catalogById(14, 'it')).resolves.toMatchObject({ name: 'Exercise 14', instructions: null });
    await expect(catalogById(999, 'en')).resolves.toBeNull();
  });
});

describe('catalogVariations', () => {
  it('returns the rest of the variation group, never the exercise itself', async () => {
    const variations = await catalogVariations(10, 'en');
    expect(variations.map((e) => e.externalId)).toEqual([11]);
  });

  it('returns nothing for an exercise without a group', async () => {
    await expect(catalogVariations(12, 'en')).resolves.toEqual([]);
  });
});

describe('catalogTaxonomy', () => {
  it('lists each table by name, muscles by their common name where there is one', async () => {
    await expect(catalogTaxonomy()).resolves.toEqual({
      categories: [
        { id: 1, name: 'Chest' },
        { id: 2, name: 'Legs' },
      ],
      equipment: [
        { id: 1, name: 'Barbell' },
        { id: 2, name: 'Dumbbell' },
      ],
      muscles: [
        { id: 1, name: 'Chest' },
        { id: 3, name: 'Quads' },
        { id: 2, name: 'Triceps brachii' },
      ],
    });
  });
});
