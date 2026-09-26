import { catalogPage, readCatalogMeta, replaceCatalog } from '../repository';
import type { CatalogPayload } from '../types';
import { createMemoryDatabase, type MemoryDatabase } from './memoryDatabase';

let mockDb: MemoryDatabase;

jest.mock('@/persistence/database', () => ({
  getDatabase: () => mockDb,
}));

// The committed snapshot, installed exactly as the app installs it: a snapshot that breaks a
// constraint, or has thinned out, fails here rather than on a user's first launch.
const bundled = require('../../../assets/catalog/wger.json') as CatalogPayload;

describe('the bundled catalog', () => {
  beforeAll(async () => {
    mockDb = createMemoryDatabase();
    await replaceCatalog(bundled, 'install', 1);
  });

  it('installs whole', async () => {
    expect(bundled.formatVersion).toBe(1);
    expect(bundled.exercises.length).toBeGreaterThanOrEqual(800);
    expect(mockDb.count('catalog_exercises')).toBe(bundled.exercises.length);
    await expect(readCatalogMeta()).resolves.toMatchObject({
      exerciseCount: bundled.exercises.length,
      generatedAt: bundled.generatedAt,
    });
  });

  it('lists every exercise in both languages', async () => {
    const all = { query: '', categoryId: null, equipmentId: null, muscleId: null };
    await expect(catalogPage(all, 'en', 0, 1)).resolves.toMatchObject({ total: bundled.exercises.length });
    await expect(catalogPage(all, 'it', 0, 1)).resolves.toMatchObject({ total: bundled.exercises.length });
  });
});
