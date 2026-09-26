/**
 * The exercise catalog, answered from SQLite.
 *
 * Implements the same port the wger adapter did, so every hook and the routine importer keep
 * their call sites. The difference is where the answer comes from: the `catalog_*` tables that
 * `replaceCatalog` fills, which means search, filters, detail and variations all work with the
 * radio off. The network only ever refreshes the catalog; it never renders it.
 *
 * The language is read at call time from the settings store, the in-app setting rather than
 * the device locale, so switching the app to Italian renames the exercises too. Query keys
 * carry the same language, so the switch refetches instead of showing the cached English page.
 *
 * The abort signal is accepted and ignored: a local read finishes in milliseconds, and TanStack
 * already discards a result whose key has moved on.
 */
import { catalogById, catalogPage, catalogTaxonomy, catalogVariations } from '@/catalog/repository';
import type { Exercise, ExerciseFilter, ExercisePage, ExerciseTaxonomy } from '@/domain/types';
import { currentLanguage } from '@/i18n/tr';
import type { ExerciseProvider } from '../types';

/** Rows per page. Local pages are cheap, but a page is still what the list renders at once. */
const PAGE_SIZE = 50;

function parseCursor(cursor: string | null): number {
  if (!cursor) return 0;
  const offset = Number(cursor);
  return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
}

class LocalExerciseProvider implements ExerciseProvider {
  /** The data is still wger's; this names the source for the About screen's credit. */
  readonly name = 'wger';

  async page(filter: ExerciseFilter, cursor: string | null): Promise<ExercisePage> {
    const offset = parseCursor(cursor);
    const { items, total } = await catalogPage(filter, currentLanguage(), offset, PAGE_SIZE);
    const fetched = offset + items.length;
    return { items, nextCursor: items.length > 0 && fetched < total ? String(fetched) : null, total };
  }

  byId(externalId: number): Promise<Exercise | null> {
    return catalogById(externalId, currentLanguage());
  }

  taxonomy(): Promise<ExerciseTaxonomy> {
    return catalogTaxonomy();
  }

  variations(externalId: number): Promise<Exercise[]> {
    return catalogVariations(externalId, currentLanguage());
  }
}

export function createLocalProvider(): ExerciseProvider {
  return new LocalExerciseProvider();
}
