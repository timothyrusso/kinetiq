import { Effect, Either, Layer } from 'effect';
import { SqliteClient } from '@/features/core/sqlite';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import { aCatalogExercise, aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import { ExerciseId } from '@/features/exercises/domain/schemas/ExerciseId';

const layer = () => CatalogRepositoryLive.pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const ALL: ExerciseFilter = { query: '', bodyArea: null, equipment: null, muscle: null };

const id = (slug: string) => ExerciseId.make(`ex:${slug}`);

const BENCH = aCatalogExercise(
  'barbell-bench-press',
  { en: 'Barbell Bench Press', it: 'Panca piana con bilanciere' },
  { secondaryMuscles: ['triceps', 'shoulders'] },
);
const DUMBBELL_BENCH = aCatalogExercise(
  'dumbbell-bench-press',
  { en: 'Dumbbell Bench Press', it: 'Distensioni su panca con manubri' },
  { equipment: 'dumbbell' },
);
const DIP = aCatalogExercise(
  'dips-triceps-version',
  { en: 'Dips' },
  { bodyArea: 'arms', primaryMuscles: ['triceps'], secondaryMuscles: ['chest'], equipment: 'body-only' },
);
const SQUAT = aCatalogExercise(
  'barbell-squat',
  { en: 'Barbell Squat', it: 'Squat con bilanciere' },
  { bodyArea: 'legs', primaryMuscles: ['quadriceps', 'glutes'], mechanic: 'compound' },
);
const PERCENT = aCatalogExercise(
  'effort-row',
  { en: '100% effort row' },
  { bodyArea: 'back', primaryMuscles: ['lats'] },
);

const count = (table: string) =>
  Effect.flatMap(SqliteClient, db =>
    Effect.promise(() => db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)),
  ).pipe(Effect.map(row => row?.n ?? 0));

/** The repository over a catalog of the five exercises above, installed at 5 000. */
const seeded = Effect.gen(function* () {
  const repository = yield* CatalogRepository;
  yield* repository.replaceCatalog(aCatalogPayload([BENCH, DUMBBELL_BENCH, DIP, SQUAT, PERCENT]), 5_000);
  return repository;
});

const replaceWith = (payload: CatalogPayload) =>
  Effect.flatMap(CatalogRepository, repository => repository.replaceCatalog(payload, 9_000));

const slugs = (exercises: readonly { id: string }[]) => exercises.map(exercise => exercise.id.slice('ex:'.length));

describe('CatalogRepositoryLive.replaceCatalog', () => {
  itEffect(
    'stamps the dataset version, the install date, the count and the format',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.readMeta).toEqual({
        datasetVersion: 1,
        installedAt: 5_000,
        exerciseCount: 5,
        formatVersion: 2,
      });
    }),
    layer(),
  );

  itEffect(
    'replaces every row on a reinstall',
    Effect.gen(function* () {
      const repository = yield* seeded;

      yield* repository.replaceCatalog(aCatalogPayload([SQUAT], { datasetVersion: 2 }), 9_000);

      expect(yield* count('catalog_exercises')).toBe(1);
      expect(yield* count('catalog_translations')).toBe(2);
      expect(yield* count('catalog_exercise_muscles')).toBe(2);
      expect(yield* count('catalog_exercise_equipment')).toBe(1);
      expect(yield* repository.byId(BENCH.id, 'en')).toBeUndefined();
      expect(yield* repository.readMeta).toEqual({
        datasetVersion: 2,
        installedAt: 9_000,
        exerciseCount: 1,
        formatVersion: 2,
      });
    }),
    layer(),
  );

  itEffect(
    'fails with SqlError and leaves the previous catalog untouched when the write fails',
    Effect.gen(function* () {
      const repository = yield* seeded;

      // NOTE: two rows with one id: the primary key rejects the insert after the delete has run.
      const result = yield* Effect.either(repository.replaceCatalog(aCatalogPayload([SQUAT, SQUAT]), 9_000));

      expect(Either.isLeft(result) && result.left._tag).toBe('SqlError');
      expect(yield* count('catalog_exercises')).toBe(5);
      expect(yield* repository.byId(BENCH.id, 'en')).toMatchObject({ name: 'Barbell Bench Press' });
      expect(yield* repository.readMeta).toMatchObject({ installedAt: 5_000, exerciseCount: 5 });
    }),
    layer(),
  );

  itEffect(
    'writes more rows than one statement can bind',
    Effect.gen(function* () {
      const many = Array.from({ length: 400 }, (_, i) =>
        aCatalogExercise(`move-${i}`, { en: `Move ${i}`, it: `Mossa ${i}` }, { primaryMuscles: ['chest', 'triceps'] }),
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
      yield* replaceWith(
        aCatalogPayload([aCatalogExercise('press', { en: 'Press' }, { primaryMuscles: ['chest', 'chest'] })]),
      );

      expect(yield* count('catalog_exercise_muscles')).toBe(1);
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.page', () => {
  itEffect(
    'names rows in the render language and orders them by that name',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const { items, total } = yield* repository.page(ALL, 'it', 0, 50);

      expect(items.map(e => e.name)).toEqual([
        '100% effort row',
        'Dips',
        'Distensioni su panca con manubri',
        'Panca piana con bilanciere',
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

      expect(slugs(italian.items)).toEqual(['barbell-bench-press', 'dumbbell-bench-press']);
      expect(slugs(english.items)).toEqual(['dumbbell-bench-press', 'barbell-bench-press']);
      expect(slugs(accented.items)).toEqual(['barbell-bench-press']);
    }),
    layer(),
  );

  itEffect(
    'ranks a whole-name match, then a name prefix, then a word prefix, then the rest',
    Effect.gen(function* () {
      const repository = yield* CatalogRepository;
      yield* replaceWith(
        aCatalogPayload([
          aCatalogExercise('one-leg-box-squat', { en: '1 Leg Box Squat' }),
          aCatalogExercise('squatting-hold', { en: 'Squatting Hold' }),
          aCatalogExercise('squat', { en: 'Squat' }),
          aCatalogExercise('box-squat', { en: 'Box Squat', it: 'Squat box' }),
          aCatalogExercise('backsquat', { en: 'Backsquat' }),
        ]),
      );

      // NOTE: rendering in Italian, box-squat is a name prefix there ("Squat box"), which outranks
      // squatting-hold's English-only prefix, and both outrank the word-start matches. In English
      // box-squat and one-leg-box-squat are both word starts, and "box squat" is the bigger family.
      const italian = yield* repository.page({ ...ALL, query: 'squat' }, 'it', 0, 50);
      const english = yield* repository.page({ ...ALL, query: 'squat' }, 'en', 0, 50);

      expect(slugs(italian.items)).toEqual(['squat', 'box-squat', 'squatting-hold', 'one-leg-box-squat', 'backsquat']);
      expect(slugs(english.items)).toEqual(['squat', 'squatting-hold', 'box-squat', 'one-leg-box-squat', 'backsquat']);
    }),
    layer(),
  );

  itEffect(
    'puts the bigger family first inside a rank, and an exact name ahead of any family',
    Effect.gen(function* () {
      const repository = yield* CatalogRepository;
      yield* replaceWith(
        aCatalogPayload([
          aCatalogExercise('bench-dips', { en: 'Bench Dips' }),
          aCatalogExercise('bench-jump', { en: 'Bench Jump' }),
          aCatalogExercise('bench-press-bands', { en: 'Bench Press With Bands' }),
          aCatalogExercise('bench-press-chains', { en: 'Bench Press With Chains' }),
          aCatalogExercise('close-grip-bench-press', { en: 'Close Grip Bench Press' }),
          aCatalogExercise('bench', { en: 'Bench' }),
        ]),
      );

      const { items } = yield* repository.page({ ...ALL, query: 'bench' }, 'en', 0, 50);

      expect(slugs(items)).toEqual([
        'bench',
        'bench-press-bands',
        'bench-press-chains',
        'bench-dips',
        'bench-jump',
        'close-grip-bench-press',
      ]);
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

      expect(slugs(percent.items)).toEqual(['effort-row']);
      expect(wildcard.total).toBe(1);
      expect(underscore.total).toBe(0);
    }),
    layer(),
  );

  itEffect(
    'filters by body area, equipment and primary muscle, by their dataset keys',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const legs = yield* repository.page({ ...ALL, bodyArea: 'legs' }, 'en', 0, 50);
      const barbell = yield* repository.page({ ...ALL, equipment: 'barbell' }, 'en', 0, 50);
      // NOTE: dips work the chest only as a secondary muscle, so the chest filter leaves them out.
      const chest = yield* repository.page({ ...ALL, muscle: 'chest' }, 'en', 0, 50);
      const glutes = yield* repository.page({ ...ALL, muscle: 'glutes' }, 'en', 0, 50);

      expect(slugs(legs.items)).toEqual(['barbell-squat']);
      expect(slugs(barbell.items)).toEqual(['effort-row', 'barbell-bench-press', 'barbell-squat']);
      expect(slugs(chest.items)).toEqual(['barbell-bench-press', 'dumbbell-bench-press']);
      expect(slugs(glutes.items)).toEqual(['barbell-squat']);
    }),
    layer(),
  );

  itEffect(
    'pages by offset and reports the filtered total',
    Effect.gen(function* () {
      const repository = yield* seeded;

      const first = yield* repository.page(ALL, 'en', 0, 2);
      const second = yield* repository.page(ALL, 'en', 2, 2);

      expect(first.items.map(e => e.name)).toEqual(['100% effort row', 'Barbell Bench Press']);
      expect(second.items.map(e => e.name)).toEqual(['Barbell Squat', 'Dips']);
      expect(second.total).toBe(5);
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.byId', () => {
  itEffect(
    'returns the full row, its taxonomy named in the render language with its equipment keys, and its images as asset paths',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.byId(BENCH.id, 'it')).toEqual({
        id: 'ex:barbell-bench-press',
        name: 'Panca piana con bilanciere',
        instructions: ['Panca piana con bilanciere, primo passo'],
        category: 'Petto',
        bodyArea: 'chest',
        trainingType: 'strength',
        level: 'beginner',
        force: 'push',
        mechanic: 'compound',
        primaryMuscles: ['Petto'],
        secondaryMuscles: ['Tricipiti', 'Spalle'],
        equipment: ['Bilanciere'],
        equipmentKeys: ['barbell'],
        imageUrl: 'assets/catalog/images/barbell-bench-press/0.webp',
        imageEndUrl: 'assets/catalog/images/barbell-bench-press/1.webp',
        thumbnailUrl: 'assets/catalog/images/barbell-bench-press/thumb.webp',
        source: 'catalog',
      });
    }),
    layer(),
  );

  itEffect(
    'names the taxonomy in English for an English read',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.byId(SQUAT.id, 'en')).toMatchObject({
        category: 'Legs',
        primaryMuscles: ['Quads', 'Glutes'],
        equipment: ['Barbell'],
        instructions: ['Barbell Squat, step one', 'Then press.'],
      });
    }),
    layer(),
  );

  itEffect(
    'reads the English steps when the render language has none',
    Effect.gen(function* () {
      yield* replaceWith(
        aCatalogPayload([
          aCatalogExercise('plank', { en: 'Plank', it: 'Plank' }, { instructions: { en: ['Hold.'], it: [] } }),
        ]),
      );

      expect((yield* (yield* CatalogRepository).byId(id('plank'), 'it'))?.instructions).toEqual(['Hold.']);
    }),
    layer(),
  );

  itEffect(
    'returns undefined for an id the catalog does not have',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.byId(id('no-such-exercise'), 'en')).toBeUndefined();
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.similar', () => {
  const target = aCatalogExercise(
    'target',
    { en: 'Target Press' },
    { primaryMuscles: ['chest', 'triceps'], mechanic: 'compound', equipment: 'barbell' },
  );
  const similarTo = (overrides: Parameters<typeof aCatalogExercise>[2], slug: string, name: string) =>
    aCatalogExercise(slug, { en: name }, { primaryMuscles: ['chest'], ...overrides });

  itEffect(
    'ranks the same first primary muscle by mechanic, then shared equipment, then name, five at most',
    Effect.gen(function* () {
      yield* replaceWith(
        aCatalogPayload([
          target,
          similarTo({ mechanic: 'isolation', equipment: 'barbell' }, 'isolation-barbell', 'A isolation barbell'),
          similarTo({ mechanic: 'compound', equipment: 'dumbbell' }, 'compound-dumbbell', 'A compound dumbbell'),
          similarTo({ mechanic: 'compound', equipment: 'barbell' }, 'compound-barbell-b', 'B compound barbell'),
          similarTo({ mechanic: 'compound', equipment: 'barbell' }, 'compound-barbell-a', 'A compound barbell'),
          similarTo({ mechanic: null, equipment: 'cable' }, 'no-mechanic', 'A no mechanic'),
          similarTo({ mechanic: 'isolation', equipment: 'cable' }, 'isolation-cable', 'Z isolation cable'),
          // NOTE: the target's first primary muscle only as a secondary one, and only its second
          // primary muscle as a primary: neither is similar.
          aCatalogExercise('secondary', { en: 'Secondary' }, { primaryMuscles: ['lats'], secondaryMuscles: ['chest'] }),
          aCatalogExercise('second-primary', { en: 'Second primary' }, { primaryMuscles: ['triceps'] }),
        ]),
      );

      const similar = yield* (yield* CatalogRepository).similar(target.id, 'en');

      expect(slugs(similar)).toEqual([
        'compound-barbell-a',
        'compound-barbell-b',
        'compound-dumbbell',
        'isolation-barbell',
        'no-mechanic',
      ]);
    }),
    layer(),
  );

  itEffect(
    'returns nothing for an id the catalog does not have',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.similar(id('no-such-exercise'), 'en')).toEqual([]);
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.taxonomy', () => {
  itEffect(
    'lists the keys the catalog uses, primary muscles only, named and ordered in English',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect(yield* repository.taxonomy('en')).toEqual({
        bodyAreas: [
          { id: 'arms', name: 'Arms' },
          { id: 'back', name: 'Back' },
          { id: 'chest', name: 'Chest' },
          { id: 'legs', name: 'Legs' },
        ],
        equipment: [
          { id: 'barbell', name: 'Barbell' },
          { id: 'body-only', name: 'Bodyweight' },
          { id: 'dumbbell', name: 'Dumbbell' },
        ],
        muscles: [
          { id: 'chest', name: 'Chest' },
          { id: 'glutes', name: 'Glutes' },
          { id: 'lats', name: 'Lats' },
          { id: 'quadriceps', name: 'Quads' },
          { id: 'triceps', name: 'Triceps' },
        ],
      });
    }),
    layer(),
  );

  itEffect(
    'names and orders each list in Italian for an Italian read',
    Effect.gen(function* () {
      const repository = yield* seeded;

      expect((yield* repository.taxonomy('it')).equipment).toEqual([
        { id: 'barbell', name: 'Bilanciere' },
        { id: 'body-only', name: 'Corpo libero' },
        { id: 'dumbbell', name: 'Manubrio' },
      ]);
    }),
    layer(),
  );
});

describe('CatalogRepositoryLive.readMeta', () => {
  itEffect(
    'reads an empty catalog as never written',
    Effect.gen(function* () {
      expect(yield* (yield* CatalogRepository).readMeta).toEqual({
        datasetVersion: null,
        installedAt: null,
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
        Effect.promise(() => db.runAsync("INSERT INTO catalog_meta (key, value) VALUES ('dataset_version', 'soon')")),
      );

      expect((yield* (yield* CatalogRepository).readMeta).datasetVersion).toBeNull();
    }),
    layer(),
  );
});
