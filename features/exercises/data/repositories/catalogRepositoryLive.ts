import { Effect, Layer, Schema } from 'effect';
import { SqliteClient, type SqliteDatabase, trySql } from '@/features/core/sqlite';
import {
  CountRow,
  decodeRows,
  EquipmentNameRow,
  type ExerciseRow,
  ExerciseRow as ExerciseRowSchema,
  MetaRow,
  MuscleNameRow,
  metaFromRows,
} from '@/features/exercises/data/adapters/catalogRows';
import { toSearchKey } from '@/features/exercises/data/adapters/searchKey';
import type { CatalogWriteKind } from '@/features/exercises/domain/entities/CatalogMeta';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { CATALOG_LANGUAGES, type CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { ExerciseFilter } from '@/features/exercises/domain/schemas/ExerciseFilterSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { TaxonSchema } from '@/features/exercises/domain/schemas/ExerciseTaxonomySchema';

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
  'catalog_muscles',
  'catalog_equipment',
  'catalog_categories',
  'catalog_meta',
] as const;

const SELECT_META = 'SELECT key, value FROM catalog_meta';

const decodeMetaSync = Schema.decodeUnknownSync(Schema.Array(MetaRow));

/** Every row of `payload`, flattened into the tables' column order. */
function catalogRows(payload: CatalogPayload) {
  const exercises: Row[] = [];
  const translations: Row[] = [];
  const muscles: Row[] = [];
  const equipment: Row[] = [];
  for (const exercise of payload.exercises) {
    exercises.push([
      exercise.id,
      exercise.externalId,
      exercise.uuid,
      exercise.variationGroup,
      exercise.categoryId,
      exercise.imageUrl,
      exercise.thumbnailUrl,
      exercise.videoUrl,
    ]);
    for (const language of CATALOG_LANGUAGES) {
      const translation = exercise.translations[language];
      const name = translation?.name.trim() ?? '';
      if (name.length === 0) continue;
      translations.push([exercise.id, language, name, toSearchKey(name), translation?.instructions ?? null]);
    }
    // NOTE: a Set per role: wger has listed the same muscle twice on one exercise, and the primary
    // key would reject the whole batch over it.
    for (const id of new Set(exercise.primaryMuscleIds)) muscles.push([exercise.id, id, 'primary']);
    for (const id of new Set(exercise.secondaryMuscleIds)) muscles.push([exercise.id, id, 'secondary']);
    for (const id of new Set(exercise.equipmentIds)) equipment.push([exercise.id, id]);
  }
  return { exercises, translations, muscles, equipment };
}

/**
 * Writes `payload` over the catalog on the transaction's connection: delete everything, insert
 * everything, stamp `catalog_meta`. A meta row that does not decode throws, which rolls the
 * transaction back like any failed statement.
 */
async function writeCatalog(
  txn: SqliteDatabase,
  payload: CatalogPayload,
  kind: CatalogWriteKind,
  now: number,
): Promise<void> {
  const rows = catalogRows(payload);
  const previous = metaFromRows(decodeMetaSync(await txn.getAllAsync<unknown>(SELECT_META)));
  for (const table of CATALOG_TABLES) await txn.execAsync(`DELETE FROM ${table};`);

  await insertRows(
    txn,
    'catalog_categories',
    ['id', 'name'],
    payload.categories.map(c => [c.id, c.name]),
  );
  await insertRows(
    txn,
    'catalog_equipment',
    ['id', 'name'],
    payload.equipment.map(e => [e.id, e.name]),
  );
  await insertRows(
    txn,
    'catalog_muscles',
    ['id', 'name', 'name_en', 'is_front'],
    payload.muscles.map(m => [m.id, m.name, m.nameEn, m.isFront ? 1 : 0]),
  );
  await insertRows(
    txn,
    'catalog_exercises',
    ['id', 'external_id', 'uuid', 'variation_group', 'category_id', 'image_url', 'thumbnail_url', 'video_url'],
    rows.exercises,
  );
  await insertRows(
    txn,
    'catalog_translations',
    ['exercise_id', 'language', 'name', 'name_search', 'instructions'],
    rows.translations,
  );
  await insertRows(txn, 'catalog_exercise_muscles', ['exercise_id', 'muscle_id', 'role'], rows.muscles);
  await insertRows(txn, 'catalog_exercise_equipment', ['exercise_id', 'equipment_id'], rows.equipment);

  const installedAt = kind === 'install' ? now : (previous.installedAt ?? now);
  const meta: [string, string | number | null][] = [
    ['source', payload.source],
    ['generated_at', payload.generatedAt],
    ['installed_at', installedAt],
    ['refreshed_at', kind === 'refresh' ? now : null],
    ['exercise_count', payload.exercises.length],
    ['format_version', payload.formatVersion],
  ];
  await insertRows(
    txn,
    'catalog_meta',
    ['key', 'value'],
    meta.filter(([, value]) => value !== null).map(([key, value]) => [key, String(value)]),
  );
}

/**
 * The row in `language`, English where that translation is missing. Parameters, in order: the
 * language. Everything after `WHERE` is appended by the caller.
 */
const SELECT_EXERCISE = `
  SELECT e.id, e.external_id,
         COALESCE(tl.name, te.name) AS name,
         COALESCE(tl.instructions, te.instructions) AS instructions,
         c.name AS category,
         e.image_url, e.thumbnail_url, e.video_url
    FROM catalog_exercises e
    LEFT JOIN catalog_translations tl ON tl.exercise_id = e.id AND tl.language = ?
    LEFT JOIN catalog_translations te ON te.exercise_id = e.id AND te.language = 'en'
    LEFT JOIN catalog_categories c ON c.id = e.category_id`;

const ORDER_BY_NAME = `ORDER BY COALESCE(tl.name_search, te.name_search), e.external_id`;

/**
 * Relevance for a search, best first: the whole name, then the start of the name, then the start
 * of any word, then anywhere; at each step a match in the render language before a match in
 * English. Without it "squat" would list "1 Leg Box Squat" first, and the routine importer, which
 * takes the top row as the closest match for a name it cannot find exactly, would pick it.
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

/** `%` and `_` in what the user typed are text, not wildcards. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, char => `\\${char}`);
}

/**
 * The WHERE clause and its parameters for `filter`. The muscle filter matches primary muscles
 * only, which is what wger's own `muscles` filter did.
 */
function filterClause(filter: ExerciseFilter, language: CatalogLanguage, term: string, escaped: string) {
  const where = ['(tl.name IS NOT NULL OR te.name IS NOT NULL)'];
  const params: (string | number)[] = [language];
  if (term.length > 0) {
    where.push(`(tl.name_search LIKE '%' || ? || '%' ESCAPE '\\' OR te.name_search LIKE '%' || ? || '%' ESCAPE '\\')`);
    params.push(escaped, escaped);
  }
  if (filter.categoryId !== null) {
    where.push('e.category_id = ?');
    params.push(filter.categoryId);
  }
  if (filter.equipmentId !== null) {
    where.push('EXISTS (SELECT 1 FROM catalog_exercise_equipment q WHERE q.exercise_id = e.id AND q.equipment_id = ?)');
    params.push(filter.equipmentId);
  }
  if (filter.muscleId !== null) {
    where.push(
      `EXISTS (SELECT 1 FROM catalog_exercise_muscles m
                WHERE m.exercise_id = e.id AND m.muscle_id = ? AND m.role = 'primary')`,
    );
    params.push(filter.muscleId);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

const decodeExercises = decodeRows(ExerciseRowSchema, 'catalog_exercises');
const decodeMuscleNames = decodeRows(MuscleNameRow, 'catalog_exercise_muscles');
const decodeEquipmentNames = decodeRows(EquipmentNameRow, 'catalog_exercise_equipment');
const decodeCount = decodeRows(CountRow, 'catalog_exercises');
const decodeMeta = decodeRows(MetaRow, 'catalog_meta');
const decodeCategories = decodeRows(TaxonSchema, 'catalog_categories');
const decodeEquipment = decodeRows(TaxonSchema, 'catalog_equipment');
const decodeMuscles = decodeRows(TaxonSchema, 'catalog_muscles');

function pushName(map: Map<string, string[]>, id: string, name: string): void {
  const list = map.get(id);
  if (list) list.push(name);
  else map.set(id, [name]);
}

/** The exercise catalog in the app database: one writer, and the reads the use cases need. */
export const CatalogRepositoryLive = Layer.effect(
  CatalogRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;

    // NOTE: muscle and equipment names for a set of rows, in two queries rather than two per row.
    const hydrate = (rows: readonly ExerciseRow[]) =>
      Effect.gen(function* () {
        if (rows.length === 0) return [];
        const ids = rows.map(row => row.id);
        const placeholders = ids.map(() => '?').join(', ');
        const [muscleRows, equipmentRows] = yield* Effect.all(
          [
            trySql('read exercise muscles', () =>
              db.getAllAsync<unknown>(
                `SELECT m.exercise_id, m.role,
                        COALESCE(NULLIF(TRIM(mu.name_en), ''), mu.name) AS name
                   FROM catalog_exercise_muscles m
                   JOIN catalog_muscles mu ON mu.id = m.muscle_id
                  WHERE m.exercise_id IN (${placeholders})
                  ORDER BY mu.id`,
                ids,
              ),
            ).pipe(Effect.flatMap(decodeMuscleNames)),
            trySql('read exercise equipment', () =>
              db.getAllAsync<unknown>(
                `SELECT q.exercise_id, eq.name
                   FROM catalog_exercise_equipment q
                   JOIN catalog_equipment eq ON eq.id = q.equipment_id
                  WHERE q.exercise_id IN (${placeholders})
                  ORDER BY eq.id`,
                ids,
              ),
            ).pipe(Effect.flatMap(decodeEquipmentNames)),
          ],
          { concurrency: 'unbounded' },
        );

        const primary = new Map<string, string[]>();
        const secondary = new Map<string, string[]>();
        const equipment = new Map<string, string[]>();
        for (const row of muscleRows) pushName(row.role === 'primary' ? primary : secondary, row.exercise_id, row.name);
        for (const row of equipmentRows) pushName(equipment, row.exercise_id, row.name);

        return rows.map(
          (row): Exercise => ({
            id: row.id,
            name: row.name ?? `Exercise ${row.external_id}`,
            instructions: row.instructions,
            category: row.category,
            primaryMuscles: primary.get(row.id) ?? [],
            secondaryMuscles: secondary.get(row.id) ?? [],
            equipment: equipment.get(row.id) ?? [],
            imageUrl: row.image_url,
            thumbnailUrl: row.thumbnail_url ?? row.image_url,
            videoUrl: row.video_url,
            source: 'remote',
            externalId: row.external_id,
          }),
        );
      });

    return {
      replaceCatalog: (payload, kind, now) =>
        trySql('replace the catalog', () =>
          db.withExclusiveTransactionAsync(txn => writeCatalog(txn, payload, kind, now)),
        ),

      readMeta: trySql('read the catalog meta', () => db.getAllAsync<unknown>(SELECT_META)).pipe(
        Effect.flatMap(decodeMeta),
        Effect.map(metaFromRows),
      ),

      page: (filter, language, offset, limit) =>
        Effect.gen(function* () {
          const term = toSearchKey(filter.query);
          const escaped = escapeLike(term);
          const { clause, params } = filterClause(filter, language, term, escaped);
          const order = term.length > 0 ? ORDER_BY_NAME.replace('ORDER BY', `ORDER BY ${SEARCH_RANK},`) : ORDER_BY_NAME;
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
          return { items: yield* hydrate(rows), total: count[0]?.n ?? 0 };
        }),

      byId: (externalId, language) =>
        trySql('read a catalog exercise', () =>
          db.getAllAsync<unknown>(`${SELECT_EXERCISE} WHERE e.external_id = ?`, [language, externalId]),
        ).pipe(
          Effect.flatMap(decodeExercises),
          Effect.flatMap(rows => hydrate(rows.slice(0, 1))),
          Effect.map(([exercise]) => exercise),
        ),

      variations: (externalId, language) =>
        trySql('read exercise variations', () =>
          db.getAllAsync<unknown>(
            `${SELECT_EXERCISE}
              WHERE e.variation_group IS NOT NULL
                AND e.variation_group = (SELECT variation_group FROM catalog_exercises WHERE external_id = ?)
                AND e.external_id <> ?
                AND (tl.name IS NOT NULL OR te.name IS NOT NULL)
              ${ORDER_BY_NAME}`,
            [language, externalId, externalId],
          ),
        ).pipe(Effect.flatMap(decodeExercises), Effect.flatMap(hydrate)),

      taxonomy: Effect.all(
        {
          categories: trySql('read the categories', () =>
            db.getAllAsync<unknown>('SELECT id, name FROM catalog_categories ORDER BY name'),
          ).pipe(Effect.flatMap(decodeCategories)),
          equipment: trySql('read the equipment', () =>
            db.getAllAsync<unknown>('SELECT id, name FROM catalog_equipment ORDER BY name'),
          ).pipe(Effect.flatMap(decodeEquipment)),
          muscles: trySql('read the muscles', () =>
            db.getAllAsync<unknown>(
              `SELECT id, COALESCE(NULLIF(TRIM(name_en), ''), name) AS name FROM catalog_muscles ORDER BY 2`,
            ),
          ).pipe(Effect.flatMap(decodeMuscles)),
        },
        { concurrency: 'unbounded' },
      ),
    };
  }),
);
