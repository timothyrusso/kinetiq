import { aCatalogMeta } from '@/features/exercises/__fixtures__/builders';
import { CATALOG_MAX_AGE_MS, isCatalogStale } from '@/features/exercises/domain/utils/catalogAge';

const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 9, 1);
const undated = aCatalogMeta({ generatedAt: null, installedAt: null, refreshedAt: null });

describe('isCatalogStale', () => {
  it('is due at 30 days, not before', () => {
    expect(isCatalogStale({ ...undated, generatedAt: NOW - CATALOG_MAX_AGE_MS + 1 }, NOW)).toBe(false);
    expect(isCatalogStale({ ...undated, generatedAt: NOW - CATALOG_MAX_AGE_MS }, NOW)).toBe(true);
  });

  it('dates the data, not the install: an old snapshot installed today is due', () => {
    expect(isCatalogStale({ ...undated, generatedAt: NOW - 60 * DAY, installedAt: NOW }, NOW)).toBe(true);
  });

  it('falls back to the refresh date, then the install date, when the data is undated', () => {
    expect(isCatalogStale({ ...undated, refreshedAt: NOW - DAY, installedAt: NOW - 90 * DAY }, NOW)).toBe(false);
    expect(isCatalogStale({ ...undated, installedAt: NOW - 90 * DAY }, NOW)).toBe(true);
  });

  it('is due when nothing is dated', () => {
    expect(isCatalogStale(undated, NOW)).toBe(true);
  });
});
