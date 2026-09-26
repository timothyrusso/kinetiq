/**
 * The exercise catalog in SQLite: one writer, and the reads the local provider needs.
 *
 * ## One writer, one transaction
 *
 * `replaceCatalog` is the only function that writes the catalog tables, and it does so in one
 * exclusive transaction: delete everything, insert everything, stamp `catalog_meta`. It runs on
 * a connection of its own, so a screen reading the catalog while a refresh is being written
 * keeps seeing the old rows until the commit, and a failure halfway leaves them untouched.
 *
 * Rows go in as multi-row `INSERT`s rather than one statement per row. A full catalog is several
 * thousand rows across the junction tables, and each statement is a round trip across the
 * native bridge; batching makes it a few dozen.
 *
 * ## Language
 *
 * Every read takes the language to render in and falls back to English per row. A row with
 * neither is left out of lists (wger has exercises translated only into other languages), and
 * named `Exercise <n>` when asked for by id, the same wording as the header's provisional title.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Exercise, ExerciseFilter, ExerciseTaxonomy, Taxon } from '@/domain/types';
import { getDatabase } from '@/persistence/database';
import { toSearchKey } from './normalize';
import type { CatalogLanguage, CatalogMeta, CatalogPayload } from './types';

const LANGUAGES: readonly CatalogLanguage[] = ['en', 'it'];

/**
 * Bound parameters per statement. SQLite builds before 3.32 cap a statement at 999, and a batch
 * well under that costs nothing measurable over a bigger one.
 */
const MAX_PARAMS = 900;

type Row = readonly (string | number | null)[];

async function insertRows(
  db: SQLiteDatabase,
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

/**
 * Swaps the whole catalog for `payload`. `install` stamps `installed_at`; `refresh` keeps the
 * install date and stamps `refreshed_at`, so the Your data screen can date the last refresh.
 */
export async function replaceCatalog(
  payload: CatalogPayload,
  kind: 'install' | 'refresh',
  now: number = Date.now(),
): Promise<void> {
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
    for (const language of LANGUAGES) {
      const translation = exercise.translations[language];
      const name = translation?.name.trim() ?? '';
      if (name.length === 0) continue;
      translations.push([exercise.id, language, name, toSearchKey(name), translation?.instructions ?? null]);
    }
    // A Set per role: wger has listed the same muscle twice on one exercise, and the primary
    // key would reject the whole batch over it.
    for (const id of new Set(exercise.primaryMuscleIds)) muscles.push([exercise.id, id, 'primary']);
    for (const id of new Set(exercise.secondaryMuscleIds)) muscles.push([exercise.id, id, 'secondary']);
    for (const id of new Set(exercise.equipmentIds)) equipment.push([exercise.id, id]);
  }

  await getDatabase().withExclusiveTransactionAsync(async (txn) => {
    const previous = await readMeta(txn);
    for (const table of CATALOG_TABLES) await txn.execAsync(`DELETE FROM ${table};`);

    await insertRows(txn, 'catalog_categories', ['id', 'name'], payload.categories.map((c) => [c.id, c.name]));
    await insertRows(txn, 'catalog_equipment', ['id', 'name'], payload.equipment.map((e) => [e.id, e.name]));
    await insertRows(
      txn,
      'catalog_muscles',
      ['id', 'name', 'name_en', 'is_front'],
      payload.muscles.map((m) => [m.id, m.name, m.nameEn, m.isFront ? 1 : 0]),
    );
    await insertRows(
      txn,
      'catalog_exercises',
      ['id', 'external_id', 'uuid', 'variation_group', 'category_id', 'image_url', 'thumbnail_url', 'video_url'],
      exercises,
    );
    await insertRows(
      txn,
      'catalog_translations',
      ['exercise_id', 'language', 'name', 'name_search', 'instructions'],
      translations,
    );
    await insertRows(txn, 'catalog_exercise_muscles', ['exercise_id', 'muscle_id', 'role'], muscles);
    await insertRows(txn, 'catalog_exercise_equipment', ['exercise_id', 'equipment_id'], equipment);

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
  });
}

async function readMeta(db: SQLiteDatabase): Promise<CatalogMeta> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM catalog_meta');
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const number = (key: string): number | null => {
    const parsed = Number(values.get(key));
    return values.has(key) && Number.isFinite(parsed) ? parsed : null;
  };
  return {
    source: values.get('source') ?? null,
    generatedAt: number('generated_at'),
    installedAt: number('installed_at'),
    refreshedAt: number('refreshed_at'),
    exerciseCount: number('exercise_count'),
    formatVersion: number('format_version'),
  };
}

export function readCatalogMeta(): Promise<CatalogMeta> {
  return readMeta(getDatabase());
}

/* ----------------------------------------------------------------- reads -- */

type ExerciseRow = {
  id: string;
  external_id: number;
  name: string | null;
  instructions: string | null;
  category: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
};

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

/** Muscle and equipment names for a set of exercises, in two queries rather than two per row. */
async function hydrate(db: SQLiteDatabase, rows: readonly ExerciseRow[]): Promise<Exercise[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [muscleRows, equipmentRows] = await Promise.all([
    db.getAllAsync<{ exercise_id: string; role: string; name: string }>(
      `SELECT m.exercise_id, m.role,
              COALESCE(NULLIF(TRIM(mu.name_en), ''), mu.name) AS name
         FROM catalog_exercise_muscles m
         JOIN catalog_muscles mu ON mu.id = m.muscle_id
        WHERE m.exercise_id IN (${placeholders})
        ORDER BY mu.id`,
      ids,
    ),
    db.getAllAsync<{ exercise_id: string; name: string }>(
      `SELECT q.exercise_id, eq.name
         FROM catalog_exercise_equipment q
         JOIN catalog_equipment eq ON eq.id = q.equipment_id
        WHERE q.exercise_id IN (${placeholders})
        ORDER BY eq.id`,
      ids,
    ),
  ]);

  const primary = new Map<string, string[]>();
  const secondary = new Map<string, string[]>();
  const equipment = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, id: string, name: string) => {
    const list = map.get(id);
    if (list) list.push(name);
    else map.set(id, [name]);
  };
  for (const row of muscleRows) push(row.role === 'primary' ? primary : secondary, row.exercise_id, row.name);
  for (const row of equipmentRows) push(equipment, row.exercise_id, row.name);

  return rows.map((row) => ({
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
  }));
}

/** `%` and `_` in what the user typed are text, not wildcards. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * One page of the filtered list, ordered by name in the render language. The muscle filter
 * matches primary muscles only, which is what wger's own `muscles` filter did.
 */
export async function catalogPage(
  filter: ExerciseFilter,
  language: CatalogLanguage,
  offset: number,
  limit: number,
): Promise<{ items: Exercise[]; total: number }> {
  const db = getDatabase();
  const term = toSearchKey(filter.query);
  const where = [`(tl.name IS NOT NULL OR te.name IS NOT NULL)`];
  const params: (string | number)[] = [language];
  if (term.length > 0) {
    where.push(`(tl.name_search LIKE ? ESCAPE '\\' OR te.name_search LIKE ? ESCAPE '\\')`);
    params.push(likePattern(term), likePattern(term));
  }
  if (filter.categoryId !== null) {
    where.push('e.category_id = ?');
    params.push(filter.categoryId);
  }
  if (filter.equipmentId !== null) {
    where.push(
      'EXISTS (SELECT 1 FROM catalog_exercise_equipment q WHERE q.exercise_id = e.id AND q.equipment_id = ?)',
    );
    params.push(filter.equipmentId);
  }
  if (filter.muscleId !== null) {
    where.push(
      `EXISTS (SELECT 1 FROM catalog_exercise_muscles m
                WHERE m.exercise_id = e.id AND m.muscle_id = ? AND m.role = 'primary')`,
    );
    params.push(filter.muscleId);
  }
  const clause = `WHERE ${where.join(' AND ')}`;

  const [rows, count] = await Promise.all([
    db.getAllAsync<ExerciseRow>(`${SELECT_EXERCISE} ${clause} ${ORDER_BY_NAME} LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]),
    db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM catalog_exercises e
         LEFT JOIN catalog_translations tl ON tl.exercise_id = e.id AND tl.language = ?
         LEFT JOIN catalog_translations te ON te.exercise_id = e.id AND te.language = 'en'
       ${clause}`,
      params,
    ),
  ]);
  return { items: await hydrate(db, rows), total: count?.n ?? 0 };
}

export async function catalogById(externalId: number, language: CatalogLanguage): Promise<Exercise | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<ExerciseRow>(`${SELECT_EXERCISE} WHERE e.external_id = ?`, [
    language,
    externalId,
  ]);
  if (!row) return null;
  const [exercise] = await hydrate(db, [row]);
  return exercise ?? null;
}

/** The other members of the exercise's variation group; never the exercise itself. */
export async function catalogVariations(externalId: number, language: CatalogLanguage): Promise<Exercise[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<ExerciseRow>(
    `${SELECT_EXERCISE}
      WHERE e.variation_group IS NOT NULL
        AND e.variation_group = (SELECT variation_group FROM catalog_exercises WHERE external_id = ?)
        AND e.external_id <> ?
        AND (tl.name IS NOT NULL OR te.name IS NOT NULL)
      ${ORDER_BY_NAME}`,
    [language, externalId, externalId],
  );
  return hydrate(db, rows);
}

/** Muscles by their common name where wger has one ("Hamstrings", not "Biceps femoris"). */
export async function catalogTaxonomy(): Promise<ExerciseTaxonomy> {
  const db = getDatabase();
  const [categories, equipment, muscles] = await Promise.all([
    db.getAllAsync<Taxon>('SELECT id, name FROM catalog_categories ORDER BY name'),
    db.getAllAsync<Taxon>('SELECT id, name FROM catalog_equipment ORDER BY name'),
    db.getAllAsync<Taxon>(
      `SELECT id, COALESCE(NULLIF(TRIM(name_en), ''), name) AS name FROM catalog_muscles ORDER BY 2`,
    ),
  ]);
  return { categories, equipment, muscles };
}
