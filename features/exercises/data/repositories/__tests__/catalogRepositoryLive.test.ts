import { Effect, Either, Layer } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { aCatalogExercise, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';

const layer = () => CatalogRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const ALL: ExerciseFilter = { query: '', categoryId: null, equipmentId: null, muscleId: null };

const BENCH = aCatalogExercise(
  10,
  { en: 'Bench Press', it: 'Panca piana' },
  { primaryMuscleIds: [4], secondaryMuscleIds: [99], equipmentIds: [1], variationGroup: 'press', imageUrl: 'big.png' },
);
const DUMBBELL_BENCH = aCatalogExercise(
  11,
  { en: 'Dumbbell Bench Press', it: 'Distensioni su panca' },
  { primaryMuscleIds: [4], equipmentIds: [3], variationGroup: 'press' },
);
const DIP = aCatalogExercise(12, { en: 'Dips' }, { primaryMuscleIds: [99], secondaryMuscleIds: [4] });
const SQUAT = aCatalogExercise(
  13,
  { en: 'Squat', it: 'Squat con bilanciere' },
  { categoryId: 9, primaryMuscleIds: [10], equipmentIds: [1] },
);
const GERMAN_ONLY = aCatalogExercise(14, {});
const PERCENT = aCatalogExercise(15, { en: '100% effort row' });

const count = (table: string) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() => db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)),
  ).pipe(Effect.map(row => row?.n ?? 0));

/** The repository over a catalog of the six exercises above, installed at 5 000. */
const seeded = Effect.gen(function* () {
  const repository = yield* CatalogRepository;
  yield* repository.replaceCatalog(
    aCatalogPayload([BENCH, DUMBBELL_BENCH, DIP, SQUAT, GERMAN_ONLY, PERCENT]),
    'install',
    5_000,
  );
  return repository;
});

const replaceWith = (payload: CatalogPayload) =>
  Effect.flatMap(CatalogRepository, repository => repository.replaceCatalog(payload, 'refresh', 9_000));

describe('CatalogRepositoryLive.replaceCatalog', () => {
  itEffect(
    'stamps the meta for an install',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.readMeta).toEqual({
        source: 'wger',
        generatedAt: 1_000,
        installedAt: 5_000,
        refreshedAt: null,
        exerciseCount: 6,
        formatVersion: 1,
      });
    }),
    layer(),
  );

  itEffect(
    'replaces every row on refresh and keeps the install date',
    Effect.gen(function* () {
      const repository = yield* seeded;

      yield* repository.replaceCatalog(aCatalogPayload([SQUAT], { generatedAt: 2_000 }), 'refresh', 9_000);

      expect(yield* count('catalog_exercises')).toBe(1);
      expect(yield* count('catalog_translations')).toBe(2);
      expect(yield* count('catalog_exercise_muscles')).toBe(1);
      expect(yield* repository.byId(10, 'en')).toBeUndefined();
      expect(yield* repository.readMeta).toMatchObject({
        generatedAt: 2_000,
        installedAt: 5_000,
        refreshedAt: 9_000,
        exerciseCount: 1,
      });
    }),
    layer(),
  );

  itEffect(
    'fails with SqlError and leaves the previous catalog untouched when the write fails',
    Effect.gen(function* () {
      const repository = yield* seeded;

      // NOTE: two rows with one id: the primary key rejects the insert after the delete has run.
      const result = yield* Effect.either(repository.replaceCatalog(aCatalogPayload([SQUAT, SQUAT]), 'refresh', 9_000));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(yield* count('catalog_exercises')).toBe(6);
      expect(yield* repository.byId(10, 'en')).toMatchObject({ name: 'Bench Press' });
      expect(yield* repository.readMeta).toMatchObject({ refreshedAt: null, exerciseCount: 6 });
    }),
    layer(),
  );

  itEffect(
    'writes more rows than one statement can bind',
    Effect.gen(function* () {
      const many = Array.from({ length: 400 }, (_, i) =>
        aCatalogExercise(
          1_000 + i,
          { en: `Move ${i}`, it: `Mossa ${i}` },
          { primaryMuscleIds: [4, 10], equipmentIds: [1] },
        ),
      );

      yield* replaceWith(aCatalogPayload(many));

      expect(yield* count('catalog_translations')).toBe(800);
      expect(yield* count('catalog_exercise_muscles')).toBe(800);
    }),
    layer(),
  );

  itEffect(
    'writes a muscle listed twice in one role once',
    Effect.gen(function* () {
      yield* replaceWith(aCatalogPayload([aCatalogExercise(10, { en: 'Bench Press' }, { primaryMuscleIds: [4, 4] })]));

      expect(yield* count('catalog_exercise_muscles')).toBe(1);
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.page', () => {
  itEffect(
    'names rows in the render language, falls back to English, and skips rows with neither',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const { items, total } = yield* repository.page(ALL, 'it', 0, 50);

      expect(items.map(e => e.name)).toEqual([
        '100% effort row',
        'Dips',
        'Distensioni su panca',
        'Panca piana',
        'Squat con bilanciere',
      ]);
      expect(total).toBe(5);
    }),
    layer(),
  );

  itEffect(
    'matches the search term in either language, ignoring case and accents',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const italian = yield* repository.page({ ...ALL, query: 'PANCA' }, 'it', 0, 50);
      const english = yield* repository.page({ ...ALL, query: 'bench' }, 'it', 0, 50);
      const accented = yield* repository.page({ ...ALL, query: 'pànca  piana' }, 'it', 0, 50);

      expect(italian.items.map(e => e.externalId)).toEqual([10, 11]);
      expect(english.items.map(e => e.externalId)).toEqual([10, 11]);
      expect(accented.items.map(e => e.externalId)).toEqual([10]);
    }),
    layer(),
  );

  itEffect(
    'ranks a whole-name match, then a name prefix, then a word prefix, then the rest',
    Effect.gen(function* () {
      const repository = yield* CatalogRepository;
      yield* replaceWith(
        aCatalogPayload([
          aCatalogExercise(20, { en: '1 Leg Box Squat' }),
          aCatalogExercise(21, { en: 'Squatting Hold' }),
          aCatalogExercise(22, { en: 'Squat' }),
          aCatalogExercise(23, { en: 'Box Squat', it: 'Squat box' }),
          aCatalogExercise(24, { en: 'Backsquat' }),
        ]),
      );

      // NOTE: rendering in Italian, 23 is a name prefix there ("Squat box"), which outranks 21's
      // English-only prefix, and both outrank the word-start match in 20.
      const italian = yield* repository.page({ ...ALL, query: 'squat' }, 'it', 0, 50);
      const english = yield* repository.page({ ...ALL, query: 'squat' }, 'en', 0, 50);

      expect(italian.items.map(e => e.externalId)).toEqual([22, 23, 21, 20, 24]);
      expect(english.items.map(e => e.externalId)).toEqual([22, 21, 20, 23, 24]);
    }),
    layer(),
  );

  itEffect(
    'puts a prefix in the render language ahead of one in English only',
    Effect.gen(function* () {
      const repository = yield* CatalogRepository;
      yield* replaceWith(
        aCatalogPayload([
          aCatalogExercise(30, { en: 'Squat Thrust', it: 'Spinte squat' }),
          aCatalogExercise(31, { en: 'Squats', it: 'Squat (stacchi)' }),
        ]),
      );

      const { items } = yield* repository.page({ ...ALL, query: 'squat' }, 'it', 0, 50);

      expect(items.map(e => e.externalId)).toEqual([31, 30]);
    }),
    layer(),
  );

  itEffect(
    'treats % and _ in the term as text',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const percent = yield* repository.page({ ...ALL, query: '100%' }, 'en', 0, 50);
      const wildcard = yield* repository.page({ ...ALL, query: '%' }, 'en', 0, 50);
      const underscore = yield* repository.page({ ...ALL, query: '_' }, 'en', 0, 50);

      expect(percent.items.map(e => e.externalId)).toEqual([15]);
      expect(wildcard.total).toBe(1);
      expect(underscore.total).toBe(0);
    }),
    layer(),
  );

  itEffect(
    'filters by category, equipment and primary muscle',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const legs = yield* repository.page({ ...ALL, categoryId: 9 }, 'en', 0, 50);
      const barbell = yield* repository.page({ ...ALL, equipmentId: 1 }, 'en', 0, 50);
      // NOTE: dips work the chest only as a secondary muscle, so the chest filter leaves them out.
      const chest = yield* repository.page({ ...ALL, muscleId: 4 }, 'en', 0, 50);

      expect(legs.items.map(e => e.externalId)).toEqual([13]);
      expect(barbell.items.map(e => e.externalId)).toEqual([10, 13]);
      expect(chest.items.map(e => e.externalId)).toEqual([10, 11]);
    }),
    layer(),
  );

  itEffect(
    'pages by offset and reports the filtered total',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const first = yield* repository.page(ALL, 'en', 0, 2);
      const second = yield* repository.page(ALL, 'en', 2, 2);

      expect(first.items.map(e => e.name)).toEqual(['100% effort row', 'Bench Press']);
      expect(second.items.map(e => e.name)).toEqual(['Dips', 'Dumbbell Bench Press']);
      expect(second.total).toBe(5);
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.byId', () => {
  itEffect(
    'returns the full row with its category, muscles and equipment named in the render language',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.byId(10, 'it')).toEqual({
        id: 'wger:10',
        name: 'Panca piana',
        instructions: 'Panca piana, come',
        category: 'Petto',
        primaryMuscles: ['Petto'],
        // NOTE: a muscle the app does not name, with no common name, so the Latin one stands.
        secondaryMuscles: ['Triceps brachii'],
        equipment: ['Bilanciere'],
        imageUrl: 'big.png',
        thumbnailUrl: 'big.png',
        videoUrl: null,
        source: 'remote',
        externalId: 10,
      });
    }),
    layer(),
  );

  itEffect(
    'names the category, muscles and equipment in English for an English read',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.byId(11, 'en')).toMatchObject({
        category: 'Chest',
        primaryMuscles: ['Chest'],
        equipment: ['Dumbbell'],
      });
    }),
    layer(),
  );

  itEffect(
    'names a row with no English or Italian translation by its id',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.byId(14, 'it')).toMatchObject({ name: 'Exercise 14', instructions: null });
    }),
    layer(),
  );

  itEffect(
    'returns undefined for an id the catalog does not have',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.byId(999, 'en')).toBeUndefined();
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.variations', () => {
  itEffect(
    'returns the rest of the variation group, never the exercise itself',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect((yield* repository.variations(10, 'en')).map(e => e.externalId)).toEqual([11]);
    }),
    layer(),
  );

  itEffect(
    'returns nothing for an exercise without a group',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.variations(12, 'en')).toEqual([]);
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.taxonomy', () => {
  itEffect(
    'lists each table by name, muscles by their common name where there is one',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.taxonomy('en')).toEqual({
        categories: [
          { id: 11, name: 'Chest' },
          { id: 9, name: 'Legs' },
        ],
        equipment: [
          { id: 1, name: 'Barbell' },
          { id: 3, name: 'Dumbbell' },
        ],
        muscles: [
          { id: 4, name: 'Chest' },
          { id: 10, name: 'Quads' },
          { id: 99, name: 'Triceps brachii' },
        ],
      });
    }),
    layer(),
  );

  itEffect(
    'names and orders each table in the render language, keeping the stored name for an id the app does not name',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.taxonomy('it')).toEqual({
        categories: [
          { id: 9, name: 'Gambe' },
          { id: 11, name: 'Petto' },
        ],
        equipment: [
          { id: 1, name: 'Bilanciere' },
          { id: 3, name: 'Manubrio' },
        ],
        muscles: [
          { id: 4, name: 'Petto' },
          { id: 10, name: 'Quadricipiti' },
          { id: 99, name: 'Triceps brachii' },
        ],
      });
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.readMeta', () => {
  itEffect(
    'reads an empty catalog as never written',
    Effect.gen(function* () {
      expect(yield* (yield* CatalogRepository).readMeta).toEqual({
        source: null,
        generatedAt: null,
        installedAt: null,
        refreshedAt: null,
        exerciseCount: null,
        formatVersion: null,
      });
    }),
    layer(),
  );

  itEffect(
    'reads a value that is not a number as unset',
    Effect.gen(function* () {
      yield* Effect.flatMap(SqliteClient, db =>
        Effect.promise(() => db.runAsync("INSERT INTO catalog_meta (key, value) VALUES ('generated_at', 'soon')")),
      );

      expect((yield* (yield* CatalogRepository).readMeta).generatedAt).toBeNull();
    }),
    layer(),
  );
});
