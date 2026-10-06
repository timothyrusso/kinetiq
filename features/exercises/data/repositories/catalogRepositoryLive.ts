import { Effect, Layer } from 'effect';
import { SqliteClient, type SqliteDatabase, trySql } from '@/features/core/sqlite';
import {
  CountRow,
  decodeRows,
  EquipmentRow,
  type ExerciseRow,
  ExerciseRow as ExerciseRowSchema,
  KeyRow,
  MetaRow,
  MuscleRow,
  metaFromRows,
  stringList,
} from '@/features/exercises/data/adapters/catalogRows';
import { toSearchKey } from '@/features/exercises/data/adapters/searchKey';
import { taxonName } from '@/features/exercises/data/adapters/taxonNames';
import { CATALOG_ASSET_ROOT } from '@/features/exercises/domain/entities/catalogAssets';
import {
  BODY_AREAS,
  EQUIPMENT,
  type Equipment,
  FORCES,
  LEVELS,
  MECHANICS,
  TRAINING_TYPES,
} from '@/features/exercises/domain/entities/catalogTaxonomy';
import type { TaxonKind } from '@/features/exercises/domain/entities/taxonKeys';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { CATALOG_LANGUAGES, type CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import { CATALOG_FORMAT_VERSION, type CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { Taxon } from '@/features/exercises/domain/schemas/ExerciseTaxonomySchema';
import { provisionalExerciseName } from '@/features/exercises/domain/utils/exerciseId';

/**
 * Bound parameters per statement. SQLite builds before 3.32 cap a statement at 999, and a batch
 * well under that costs nothing measurable over a bigger one.
 */
const MAX_PARAMS = 900;

type Row = readonly (string | number | null)[];

/**
 * Inserts `rows` as multi-row `INSERT`s rather than one statement per row: a full catalog is
 * several thousand rows across the junction tables, and each statement is a round trip across the
 * native bridge, so batching makes it a few dozen.
 */
async function insertRows(
  db: SqliteDatabase,
  table: string,
  columns: readonly string[],
  rows: readonly Row[],
): Promise<void> {
  const perStatement = Math.max(1, Math.floor(MAX_PARAMS / columns.length));
  const tuple = `(${columns.map(() => '?').join(', ')})`;
  for (let start = 0; start < rows.length; start += perStatement) {
    const chunk = rows.slice(start, start + perStatement);
    await db.runAsync(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => tuple).join(', ')}`,
      chunk.flat(),
    );
  }
}

/** Children first, so the foreign keys hold at every step if they are enforced. */
const CATALOG_TABLES = [
  'catalog_exercise_equipment',
  'catalog_exercise_muscles',
  'catalog_translations',
  'catalog_exercises',
  'catalog_meta',
] as const;

const SELECT_META = 'SELECT key, value FROM catalog_meta';

/** The first two words of a search key: the phrase that names an exercise's family. */
function leadPhrase(searchKey: string): string {
  return searchKey.split(' ').slice(0, 2).join(' ');
}

/**
 * For each search key, how many keys in the list contain its lead phrase. "bench press" heads a
 * family of twenty, "bench dips" is a one-off, so within one search rank the family comes first.
 * Computed once, at install, over a list of a few hundred names.
 */
function leadCounts(searchKeys: readonly string[]): number[] {
  const counts = new Map<string, number>();
  for (const phrase of new Set(searchKeys.map(leadPhrase))) {
    counts.set(phrase, searchKeys.filter(key => key.includes(phrase)).length);
  }
  return searchKeys.map(key => counts.get(leadPhrase(key)) ?? 0);
}

/** Every row of `payload`, flattened into the tables' column order. */
function catalogRows(payload: CatalogPayload) {
  const exercises: Row[] = [];
  const translations: Row[] = [];
  const muscles: Row[] = [];
  const equipment: Row[] = [];
  for (const exercise of payload.exercises) {
    exercises.push([
      exercise.id,
      exercise.bodyArea,
      exercise.trainingType,
      exercise.level,
      exercise.force,
      exercise.mechanic,
      `${CATALOG_ASSET_ROOT}${exercise.images.start}`,
      `${CATALOG_ASSET_ROOT}${exercise.images.end}`,
      `${CATALOG_ASSET_ROOT}${exercise.images.thumb}`,
    ]);
    // NOTE: a Set per role, so a muscle a hand edit lists twice cannot fail the whole batch on the
    // primary key; the position is the muscle's place in the dataset's list.
    [...new Set(exercise.primaryMuscles)].forEach((muscle, position) => {
      muscles.push([exercise.id, muscle, 'primary', position]);
    });
    [...new Set(exercise.secondaryMuscles)].forEach((muscle, position) => {
      muscles.push([exercise.id, muscle, 'secondary', position]);
    });
    equipment.push([exercise.id, exercise.equipment]);
  }
  for (const language of CATALOG_LANGUAGES) {
    const named = payload.exercises
      .map(exercise => ({ exercise, name: exercise.name[language].trim() }))
      .filter(({ name }) => name.length > 0);
    const keys = named.map(({ name }) => toSearchKey(name));
    const leads = leadCounts(keys);
    named.forEach(({ exercise, name }, index) => {
      translations.push([
        exercise.id,
        language,
        name,
        keys[index] ?? '',
        leads[index] ?? 0,
        JSON.stringify(exercise.instructions[language]),
      ]);
    });
  }
  return { exercises, translations, muscles, equipment };
}

/**
 * Writes `payload` over the catalog on the transaction's connection: delete everything, insert
 * everything, stamp `catalog_meta`.
 */
async function writeCatalog(txn: SqliteDatabase, payload: CatalogPayload, now: number): Promise<void> {
  const rows = catalogRows(payload);
  for (const table of CATALOG_TABLES) await txn.execAsync(`DELETE FROM ${table};`);

  await insertRows(
    txn,
    'catalog_exercises',
    ['id', 'body_area', 'training_type', 'level', 'force', 'mechanic', 'image_start', 'image_end', 'thumbnail'],
    rows.exercises,
  );
  await insertRows(
    txn,
    'catalog_translations',
    ['exercise_id', 'language', 'name', 'name_search', 'lead_count', 'instructions'],
    rows.translations,
  );
  await insertRows(txn, 'catalog_exercise_muscles', ['exercise_id', 'muscle', 'role', 'position'], rows.muscles);
  await insertRows(txn, 'catalog_exercise_equipment', ['exercise_id', 'equipment'], rows.equipment);

  const meta: [string, number][] = [
    ['dataset_version', payload.datasetVersion],
    ['installed_at', now],
    ['exercise_count', payload.exercises.length],
    ['format_version', CATALOG_FORMAT_VERSION],
  ];
  await insertRows(
    txn,
    'catalog_meta',
    ['key', 'value'],
    meta.map(([key, value]) => [key, String(value)]),
  );
}

/**
 * The row in `language`, English where that translation is missing (and the steps in English
 * where the language has none). Parameters, in order: the language. Everything after `WHERE` is
 * appended by the caller.
 */
const SELECT_EXERCISE = `
  SELECT e.id,
         COALESCE(tl.name, te.name) AS name,
         COALESCE(NULLIF(tl.instructions, '[]'), te.instructions) AS instructions,
         e.body_area, e.training_type, e.level, e.force, e.mechanic,
         e.image_start, e.image_end, e.thumbnail
    FROM catalog_exercises e
    LEFT JOIN catalog_translations tl ON tl.exercise_id = e.id AND tl.language = ?
    LEFT JOIN catalog_translations te ON te.exercise_id = e.id AND te.language = 'en'`;

const ORDER_BY_NAME = `ORDER BY COALESCE(tl.name_search, te.name_search), e.id`;

/**
 * Relevance for a search, best first: the whole name, then the start of the name, then the start
 * of any word, then anywhere; at each step a match in the render language before a match in
 * English. Inside a step, the bigger family first (`SEARCH_FAMILY`), then the name. Without it "squat" would list "Barbell Full Squat" first, and the routine importer,
 * which takes the top row as the closest match for a name it cannot find exactly, would pick it.
 * Parameters: the term twice, then the escaped term four times.
 */
const SEARCH_RANK = `
  CASE
    WHEN tl.name_search = ? THEN 0
    WHEN te.name_search = ? THEN 1
    WHEN tl.name_search LIKE ? || '%' ESCAPE '\\' THEN 2
    WHEN te.name_search LIKE ? || '%' ESCAPE '\\' THEN 3
    WHEN tl.name_search LIKE '% ' || ? || '%' ESCAPE '\\' THEN 4
    WHEN te.name_search LIKE '% ' || ? || '%' ESCAPE '\\' THEN 5
    ELSE 6
  END`;

/**
 * The tiebreak inside a rank: the name's family size in the render language, else in English, so
 * "bench" lists the bench presses before "Bench Dips".
 */
const SEARCH_FAMILY = 'COALESCE(tl.lead_count, te.lead_count) DESC';

/** `%` and `_` in what the user typed are text, not wildcards. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, char => `\\${char}`);
}

/** The WHERE clause and its parameters for `filter`. The muscle filter matches primary muscles only. */
function filterClause(filter: ExerciseFilter, language: CatalogLanguage, term: string, escaped: string) {
  const where = ['(tl.name IS NOT NULL OR te.name IS NOT NULL)'];
  const params: (string | number)[] = [language];
  if (term.length > 0) {
    where.push(`(tl.name_search LIKE '%' || ? || '%' ESCAPE '\\' OR te.name_search LIKE '%' || ? || '%' ESCAPE '\\')`);
    params.push(escaped, escaped);
  }
  if (filter.bodyArea !== null) {
    where.push('e.body_area = ?');
    params.push(filter.bodyArea);
  }
  if (filter.equipment !== null) {
    where.push('EXISTS (SELECT 1 FROM catalog_exercise_equipment q WHERE q.exercise_id = e.id AND q.equipment = ?)');
    params.push(filter.equipment);
  }
  if (filter.muscle !== null) {
    where.push(
      `EXISTS (SELECT 1 FROM catalog_exercise_muscles m
                WHERE m.exercise_id = e.id AND m.muscle = ? AND m.role = 'primary')`,
    );
    params.push(filter.muscle);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

/**
 * The exercises sharing the target's first primary muscle, ranked as `similar` documents.
 * Parameters: the language, then the target id four times.
 */
const SELECT_SIMILAR = `${SELECT_EXERCISE}
  WHERE e.id <> ?
    AND (tl.name IS NOT NULL OR te.name IS NOT NULL)
    AND EXISTS (
      SELECT 1 FROM catalog_exercise_muscles m
       WHERE m.exercise_id = e.id AND m.role = 'primary'
         AND m.muscle = (SELECT muscle FROM catalog_exercise_muscles
                          WHERE exercise_id = ? AND role = 'primary' ORDER BY position LIMIT 1))
  ORDER BY
    (e.mechanic IS NOT NULL AND e.mechanic = (SELECT mechanic FROM catalog_exercises WHERE id = ?)) DESC,
    (SELECT COUNT(*) FROM catalog_exercise_equipment q
      WHERE q.exercise_id = e.id
        AND q.equipment IN (SELECT equipment FROM catalog_exercise_equipment WHERE exercise_id = ?)) DESC,
    COALESCE(tl.name_search, te.name_search), e.id
  LIMIT 5`;

const decodeExercises = decodeRows(ExerciseRowSchema, 'catalog_exercises');
const decodeMuscles = decodeRows(MuscleRow, 'catalog_exercise_muscles');
const decodeEquipment = decodeRows(EquipmentRow, 'catalog_exercise_equipment');
const decodeKeys = decodeRows(KeyRow, 'catalog_exercises');
const decodeCount = decodeRows(CountRow, 'catalog_exercises');
const decodeMeta = decodeRows(MetaRow, 'catalog_meta');

/** `value` when it is one of `values`, else null: a column the dataset vocabulary does not know. */
function oneOf<T extends string>(values: readonly T[], value: string | null): T | null {
  return values.find(candidate => candidate === value) ?? null;
}

function pushName(map: Map<string, string[]>, id: string, name: string): void {
  const list = map.get(id);
  if (list) list.push(name);
  else map.set(id, [name]);
}

/**
 * `keys` named in `language` and ordered by that name, compared as SQLite's default collation
 * compares, so a list reads in the order an `ORDER BY name` would give.
 */
function namedTaxa(kind: TaxonKind, keys: readonly string[], language: CatalogLanguage): readonly Taxon[] {
  return keys
    .map(key => ({ id: key, name: taxonName(kind, key, language) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The exercise catalog in the app database: one writer, and the reads the use cases need. */
export const CatalogRepositoryLive = Layer.effect(
  CatalogRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;

    // NOTE: muscle and equipment keys for a set of rows, in two queries rather than two per row.
    const hydrate = (rows: readonly ExerciseRow[], language: CatalogLanguage) =>
      Effect.gen(function* () {
        if (rows.length === 0) return [];
        const ids = rows.map(row => row.id);
        const placeholders = ids.map(() => '?').join(', ');
        const [muscleRows, equipmentRows] = yield* Effect.all(
          [
            trySql('read exercise muscles', () =>
              db.getAllAsync<unknown>(
                `SELECT exercise_id, muscle, role FROM catalog_exercise_muscles
                  WHERE exercise_id IN (${placeholders})
                  ORDER BY position`,
                ids,
              ),
            ).pipe(Effect.flatMap(decodeMuscles)),
            trySql('read exercise equipment', () =>
              db.getAllAsync<unknown>(
                `SELECT exercise_id, equipment FROM catalog_exercise_equipment
                  WHERE exercise_id IN (${placeholders})
                  ORDER BY equipment`,
                ids,
              ),
            ).pipe(Effect.flatMap(decodeEquipment)),
          ],
          { concurrency: 'unbounded' },
        );

        const primary = new Map<string, string[]>();
        const secondary = new Map<string, string[]>();
        const equipment = new Map<string, string[]>();
        const equipmentKeys = new Map<string, Equipment[]>();
        for (const row of muscleRows) {
          pushName(
            row.role === 'primary' ? primary : secondary,
            row.exercise_id,
            taxonName('muscle', row.muscle, language),
          );
        }
        for (const row of equipmentRows) {
          pushName(equipment, row.exercise_id, taxonName('equipment', row.equipment, language));
          const key = oneOf(EQUIPMENT, row.equipment);
          if (key !== null) equipmentKeys.set(row.exercise_id, [...(equipmentKeys.get(row.exercise_id) ?? []), key]);
        }

        return rows.map(
          (row): Exercise => ({
            id: row.id,
            name: row.name ?? provisionalExerciseName(row.id),
            instructions: stringList(row.instructions),
            category: taxonName('bodyArea', row.body_area, language),
            bodyArea: oneOf(BODY_AREAS, row.body_area),
            trainingType: oneOf(TRAINING_TYPES, row.training_type),
            level: oneOf(LEVELS, row.level),
            force: oneOf(FORCES, row.force),
            mechanic: oneOf(MECHANICS, row.mechanic),
            primaryMuscles: primary.get(row.id) ?? [],
            secondaryMuscles: secondary.get(row.id) ?? [],
            equipment: equipment.get(row.id) ?? [],
            equipmentKeys: equipmentKeys.get(row.id) ?? [],
            imageUrl: row.image_start,
            imageEndUrl: row.image_end,
            thumbnailUrl: row.thumbnail ?? row.image_start,
            source: 'catalog',
          }),
        );
      });

    const keysOf = (label: string, sql: string) =>
      trySql(label, () => db.getAllAsync<unknown>(sql)).pipe(
        Effect.flatMap(decodeKeys),
        Effect.map(rows => rows.map(row => row.key)),
      );

    return {
      replaceCatalog: (payload, now) =>
        trySql('replace the catalog', () => db.withExclusiveTransactionAsync(txn => writeCatalog(txn, payload, now))),

      readMeta: trySql('read the catalog meta', () => db.getAllAsync<unknown>(SELECT_META)).pipe(
        Effect.flatMap(decodeMeta),
        Effect.map(metaFromRows),
      ),

      page: (filter, language, offset, limit) =>
        Effect.gen(function* () {
          const term = toSearchKey(filter.query);
          const escaped = escapeLike(term);
          const { clause, params } = filterClause(filter, language, term, escaped);
          const order =
            term.length > 0
              ? ORDER_BY_NAME.replace('ORDER BY', `ORDER BY ${SEARCH_RANK}, ${SEARCH_FAMILY},`)
              : ORDER_BY_NAME;
          const rankParams = term.length > 0 ? [term, term, escaped, escaped, escaped, escaped] : [];
          const [rows, count] = yield* Effect.all(
            [
              trySql('read a catalog page', () =>
                db.getAllAsync<unknown>(`${SELECT_EXERCISE} ${clause} ${order} LIMIT ? OFFSET ?`, [
                  ...params,
                  ...rankParams,
                  limit,
                  offset,
                ]),
              ).pipe(Effect.flatMap(decodeExercises)),
              trySql('count a catalog page', () =>
                db.getAllAsync<unknown>(
                  `SELECT COUNT(*) AS n FROM catalog_exercises e
                     LEFT JOIN catalog_translations tl ON tl.exercise_id = e.id AND tl.language = ?
                     LEFT JOIN catalog_translations te ON te.exercise_id = e.id AND te.language = 'en'
                   ${clause}`,
                  params,
                ),
              ).pipe(Effect.flatMap(decodeCount)),
            ],
            { concurrency: 'unbounded' },
          );
          return { items: yield* hydrate(rows, language), total: count[0]?.n ?? 0 };
        }),

      byId: (id, language) =>
        trySql('read a catalog exercise', () =>
          db.getAllAsync<unknown>(`${SELECT_EXERCISE} WHERE e.id = ?`, [language, id]),
        ).pipe(
          Effect.flatMap(decodeExercises),
          Effect.flatMap(rows => hydrate(rows.slice(0, 1), language)),
          Effect.map(([exercise]) => exercise),
        ),

      similar: (id, language) =>
        trySql('read similar exercises', () =>
          db.getAllAsync<unknown>(SELECT_SIMILAR, [language, id, id, id, id]),
        ).pipe(
          Effect.flatMap(decodeExercises),
          Effect.flatMap(rows => hydrate(rows, language)),
        ),

      taxonomy: language =>
        Effect.all(
          {
            bodyAreas: keysOf('read the body areas', 'SELECT DISTINCT body_area AS key FROM catalog_exercises').pipe(
              Effect.map(keys => namedTaxa('bodyArea', keys, language)),
            ),
            equipment: keysOf(
              'read the equipment',
              'SELECT DISTINCT equipment AS key FROM catalog_exercise_equipment',
            ).pipe(Effect.map(keys => namedTaxa('equipment', keys, language))),
            muscles: keysOf(
              'read the muscles',
              `SELECT DISTINCT muscle AS key FROM catalog_exercise_muscles WHERE role = 'primary'`,
            ).pipe(Effect.map(keys => namedTaxa('muscle', keys, language))),
          },
          { concurrency: 'unbounded' },
        ),
    };
  }),
);
