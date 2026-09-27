import { Effect, Layer, Schema } from 'effect';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import legacyReads from '@/features/exercises/__fixtures__/bundledCatalogReads.json';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

/**
 * The reads of the legacy repository over the bundled catalog, recorded before the migration
 * (`__fixtures__/bundledCatalogReads.json`), replayed against `CatalogRepositoryLive`: the same
 * pages, details, variations and taxonomy, value for value.
 */
const layer = () =>
  Layer.mergeAll(CatalogRepositoryLive, BundledCatalogSourceLive).pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const installed = Effect.gen(function* () {
  const repository = yield* CatalogRepository;
  yield* repository.replaceCatalog(yield* (yield* BundledCatalog).load, 'install', 1);
  return repository;
});

const language = Schema.decodeUnknownSync(CatalogLanguage);

describe('CatalogRepositoryLive over the bundled catalog', () => {
  itEffect(
    'installs whole: at least 800 exercises, and every one listed in both languages',
    Effect.gen(function* () {
      const repository = yield* installed;
      const payload = yield* (yield* BundledCatalog).load;
      const all = { query: '', categoryId: null, equipmentId: null, muscleId: null };

      expect(payload.exercises.length).toBeGreaterThanOrEqual(800);
      expect((yield* repository.readMeta).exerciseCount).toBe(payload.exercises.length);
      expect((yield* repository.page(all, 'en', 0, 1)).total).toBe(payload.exercises.length);
      expect((yield* repository.page(all, 'it', 0, 1)).total).toBe(payload.exercises.length);
    }),
    layer(),
  );

  itEffect(
    'reads the same meta and taxonomy as the legacy repository',
    Effect.gen(function* () {
      const repository = yield* installed;

      expect(yield* repository.readMeta).toEqual(legacyReads.meta);
      expect(yield* repository.taxonomy).toEqual(legacyReads.taxonomy);
    }),
    layer(),
  );

  itEffect(
    'answers every recorded page as the legacy repository did',
    Effect.gen(function* () {
      const repository = yield* installed;

      for (const recorded of legacyReads.pages) {
        const page = yield* repository.page(
          recorded.filter,
          language(recorded.language),
          recorded.offset,
          recorded.limit,
        );
        expect({ filter: recorded.filter, language: recorded.language, offset: recorded.offset, result: page }).toEqual(
          {
            filter: recorded.filter,
            language: recorded.language,
            offset: recorded.offset,
            result: recorded.result,
          },
        );
      }
    }),
    layer(),
  );

  itEffect(
    'answers every recorded detail and variation list as the legacy repository did',
    Effect.gen(function* () {
      const repository = yield* installed;

      for (const recorded of legacyReads.details) {
        const exercise = yield* repository.byId(recorded.externalId, language(recorded.language));
        expect(exercise ?? null).toEqual(recorded.result);
      }
      for (const recorded of legacyReads.variations) {
        expect(yield* repository.variations(recorded.externalId, language(recorded.language))).toEqual(recorded.result);
      }
    }),
    layer(),
  );
});
