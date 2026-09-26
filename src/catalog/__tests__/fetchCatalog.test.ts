import { fetchCatalog, WGER_BASE_URL } from '../fetchCatalog';

type Row = Record<string, unknown>;

function info(id: number, fields: Row = {}): Row {
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

/** A fake wger that serves `rows` at most `cap` per page, whatever limit is asked for. */
function fakeWger(rows: Row[], cap: number) {
  const requested: string[] = [];
  const fetchJson = async (url: string): Promise<unknown> => {
    requested.push(url);
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

describe('fetchCatalog', () => {
  it('follows the page size the server actually returns until every row is in', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => info(i + 1));
    const wger = fakeWger(rows, 3);

    const payload = await fetchCatalog(wger.fetchJson, { now: () => 42 });

    expect(payload.exercises.map((e) => e.externalId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(wger.requested.filter((u) => u.includes('exerciseinfo/'))).toHaveLength(3);
    expect(wger.requested.some((u) => u.includes('language__code'))).toBe(false);
    expect(payload.generatedAt).toBe(42);
  });

  it('keeps English and Italian by language id and nothing else', async () => {
    const rows = [
      info(1, {
        translations: [
          { id: 1, language: 1, name: 'Bankdrücken' },
          { id: 2, language: 13, name: 'Panca piana', description_source: '*Scendi* piano' },
          { id: 3, language: 2, name: 'Bench Press', description: '<ul><li>Lower slowly</li></ul>' },
        ],
      }),
    ];
    const payload = await fetchCatalog(fakeWger(rows, 100).fetchJson);

    expect(payload.exercises[0]?.translations).toEqual({
      en: { name: 'Bench Press', instructions: '• Lower slowly' },
      it: { name: 'Panca piana', instructions: 'Scendi piano' },
    });
  });

  it('drops rows it cannot show and ids the taxonomy does not list', async () => {
    const rows = [
      info(1, { translations: [{ id: 1, language: 1, name: 'Nur Deutsch' }] }),
      info(2, { category: null }),
      info(3, { category: { id: 99, name: 'Gone' } }),
      info(4, { muscles: [{ id: 1, name: 'x' }, { id: 50, name: 'y' }], equipment: [{ id: 7, name: 'z' }] }),
      info(4),
    ];
    const payload = await fetchCatalog(fakeWger(rows, 100).fetchJson);

    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({ externalId: 4, primaryMuscleIds: [1], equipmentIds: [] });
  });

  it('folds em and en dashes out of names and instructions', async () => {
    const rows = [
      info(1, {
        translations: [
          {
            id: 1,
            language: 2,
            name: 'Row \u2013 seated',
            description: '<p>Lower to 45\u201360 degrees\u2014do not flare.</p>',
          },
        ],
      }),
    ];
    const payload = await fetchCatalog(fakeWger(rows, 100).fetchJson);

    expect(payload.exercises[0]?.translations.en).toEqual({
      name: 'Row: seated',
      instructions: 'Lower to 45-60 degrees: do not flare.',
    });
  });

  it('sorts the taxonomy by id and maps muscles to both names', async () => {
    const payload = await fetchCatalog(fakeWger([info(1)], 100).fetchJson);

    expect(payload.categories).toEqual([{ id: 1, name: 'Chest' }, { id: 2, name: 'Legs' }]);
    expect(payload.muscles).toEqual([{ id: 1, name: 'Pectoralis major', nameEn: 'Chest', isFront: true }]);
  });
});
