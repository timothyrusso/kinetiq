import { CATALOG_MAX_AGE_MS, isCatalogStale, maybeRefreshCatalog, refreshCatalogNow } from '../refresh';
import { catalogById, readCatalogMeta, replaceCatalog } from '../repository';
import type { CatalogMeta, CatalogPayload } from '../types';
import { fakeWger, info } from './fakeWger';
import { createMemoryDatabase, type MemoryDatabase } from './memoryDatabase';

let mockDb: MemoryDatabase;
let mockWger: ReturnType<typeof fakeWger>;
const mockNetwork = { online: true, known: true };
const mockInvalidate = jest.fn(async () => undefined);

jest.mock('@/persistence/database', () => ({ getDatabase: () => mockDb }));
jest.mock('@/query/networkStatus', () => ({
  getNetworkStatus: () => mockNetwork,
  subscribeNetworkStatus: () => () => undefined,
}));
jest.mock('@/query/client', () => ({ getQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
jest.mock('@/api/http', () => ({
  requestJson: async (url: string) => ({ data: await mockWger.fetchJson(url), total: null }),
}));

const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 9, 1);

/** The installed catalog: one exercise, generated `ageDays` before NOW. */
function installed(ageDays: number): CatalogPayload {
  return {
    formatVersion: 1,
    source: 'wger',
    generatedAt: NOW - ageDays * DAY,
    categories: [{ id: 1, name: 'Chest' }],
    equipment: [],
    muscles: [],
    exercises: [
      {
        id: 'wger:500',
        externalId: 500,
        uuid: null,
        variationGroup: null,
        categoryId: 1,
        primaryMuscleIds: [],
        secondaryMuscleIds: [],
        equipmentIds: [],
        imageUrl: null,
        thumbnailUrl: null,
        videoUrl: null,
        translations: { en: { name: 'Old row', instructions: null } },
      },
    ],
  };
}

const exerciseinfoRequests = () => mockWger.requested.filter((url) => url.includes('exerciseinfo/'));

beforeEach(async () => {
  mockDb = createMemoryDatabase();
  mockWger = fakeWger([info(1), info(2), info(3)], 2);
  mockNetwork.online = true;
  mockInvalidate.mockClear();
  await replaceCatalog(installed(31), 'install', NOW - 31 * DAY);
});

describe('isCatalogStale', () => {
  const meta = (fields: Partial<CatalogMeta>): CatalogMeta => ({
    source: 'wger',
    generatedAt: null,
    installedAt: null,
    refreshedAt: null,
    exerciseCount: 1,
    formatVersion: 1,
    ...fields,
  });

  it('is due at 30 days, not before', () => {
    expect(isCatalogStale(meta({ generatedAt: NOW - CATALOG_MAX_AGE_MS + 1 }), NOW)).toBe(false);
    expect(isCatalogStale(meta({ generatedAt: NOW - CATALOG_MAX_AGE_MS }), NOW)).toBe(true);
  });

  it('dates the data, not the install: an old snapshot installed today is due', () => {
    expect(isCatalogStale(meta({ generatedAt: NOW - 60 * DAY, installedAt: NOW }), NOW)).toBe(true);
  });

  it('is due when nothing is dated', () => {
    expect(isCatalogStale(meta({}), NOW)).toBe(true);
  });
});

describe('maybeRefreshCatalog', () => {
  it('downloads, swaps and invalidates when online and stale', async () => {
    await maybeRefreshCatalog(NOW);

    await expect(catalogById(500, 'en')).resolves.toBeNull();
    await expect(catalogById(2, 'en')).resolves.toMatchObject({ name: 'Exercise 2' });
    const meta = await readCatalogMeta();
    expect(meta).toMatchObject({ exerciseCount: 3, installedAt: NOW - 31 * DAY });
    expect(meta.refreshedAt).not.toBeNull();
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['exercises'] });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['catalog'] });
  });

  it('sends no request when the catalog is younger than 30 days', async () => {
    await replaceCatalog(installed(29), 'install', NOW);
    await maybeRefreshCatalog(NOW);

    expect(mockWger.requested).toEqual([]);
  });

  it('sends no request offline, and shows nothing', async () => {
    mockNetwork.online = false;
    await expect(maybeRefreshCatalog(NOW)).resolves.toBeUndefined();

    expect(mockWger.requested).toEqual([]);
  });

  it('swallows a failure and leaves the current catalog whole', async () => {
    mockWger = fakeWger([info(1), info(2), info(3)], 2, (url) => url.includes('offset=2'));
    await expect(maybeRefreshCatalog(NOW)).resolves.toBeUndefined();

    await expect(catalogById(500, 'en')).resolves.toMatchObject({ name: 'Old row' });
    expect(mockDb.count('catalog_exercises')).toBe(1);
    await expect(readCatalogMeta()).resolves.toMatchObject({ refreshedAt: null });
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});

describe('refreshCatalogNow', () => {
  it('rejects so the row can show the reason, and the next attempt starts from page 1', async () => {
    mockWger = fakeWger([info(1), info(2), info(3)], 2, (url) => url.includes('offset=2'));
    await expect(refreshCatalogNow()).rejects.toThrow('failed');

    mockWger = fakeWger([info(1), info(2), info(3)], 2);
    await refreshCatalogNow();
    expect(exerciseinfoRequests()[0]).toContain('offset=0');
    expect(mockDb.count('catalog_exercises')).toBe(3);
  });

  it('refreshes a catalog that is not due yet', async () => {
    await replaceCatalog(installed(1), 'install', NOW);
    await refreshCatalogNow();

    expect(mockDb.count('catalog_exercises')).toBe(3);
  });

  it('shares one download between every caller while it runs', async () => {
    await Promise.all([refreshCatalogNow(), refreshCatalogNow(), maybeRefreshCatalog(NOW)]);

    // Three rows at two per page: two pages, requested once.
    expect(exerciseinfoRequests()).toHaveLength(2);
  });
});
