/**
 * A fake wger for the catalog tests: the four small endpoints plus `exerciseinfo/`, served from
 * an array at most `cap` rows per page whatever limit is asked for, recording every URL. `failAt`
 * makes one request throw, to test that a failed download leaves nothing behind.
 */
import { WGER_BASE_URL } from '../fetchCatalog';

type Row = Record<string, unknown>;

export function info(id: number, fields: Row = {}): Row {
  return {
    id,
    uuid: `uuid-${id}`,
    category: { id: 1, name: 'Chest' },
    muscles: [{ id: 1, name: 'Pectoralis major' }],
    muscles_secondary: [],
    equipment: [{ id: 1, name: 'Barbell' }],
    images: [],
    videos: [],
    variation_group: null,
    translations: [
      { id: id * 10, language: 1, name: `Übung ${id}`, description: '<p>Deutsch</p>' },
      { id: id * 10 + 1, language: 2, name: `Exercise ${id}`, description: '<p>Keep it slow</p>' },
    ],
    ...fields,
  };
}

export function fakeWger(rows: Row[], cap: number, failAt?: (url: string) => boolean) {
  const requested: string[] = [];
  const fetchJson = async (url: string): Promise<unknown> => {
    requested.push(url);
    if (failAt?.(url)) throw new Error(`failed ${url}`);
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace(new URL(WGER_BASE_URL).pathname, '');
    const list = (results: Row[]) => ({ count: results.length, next: null, previous: null, results });
    switch (path) {
      case 'language/':
        return list([
          { id: 1, short_name: 'de', full_name: 'Deutsch' },
          { id: 2, short_name: 'en', full_name: 'English' },
          { id: 13, short_name: 'it', full_name: 'Italiano' },
        ]);
      case 'exercisecategory/':
        return list([{ id: 2, name: 'Legs' }, { id: 1, name: 'Chest' }]);
      case 'equipment/':
        return list([{ id: 1, name: 'Barbell' }]);
      case 'muscle/':
        return list([{ id: 1, name: 'Pectoralis major', name_en: 'Chest', is_front: true }]);
      case 'exerciseinfo/': {
        const offset = Number(searchParams.get('offset'));
        const limit = Math.min(Number(searchParams.get('limit')), cap);
        return { count: rows.length, next: null, previous: null, results: rows.slice(offset, offset + limit) };
      }
      default:
        throw new Error(`unexpected ${url}`);
    }
  };
  return { fetchJson, requested };
}
