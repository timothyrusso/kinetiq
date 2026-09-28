import { Effect, Layer, Schema } from 'effect';
import { itEffect, makeMigratedSqliteLayer } from '@/features/core/testing';
import legacyReads from '@/features/exercises/__fixtures__/bundledCatalogReads.json';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { CatalogLanguage } from '@/features/exercises/domain/schemas/CatalogLanguage';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';
import { taxonName } from '@/features/exercises/mappers/taxonNames';

/**
 * The reads of the legacy repository over the bundled catalog, recorded before the migration
 * (`__fixtures__/bundledCatalogReads.json`), replayed against `CatalogRepositoryLive`: the same
 * pages, details, variations and taxonomy, value for value. The legacy repository named
 * categories, muscles and equipment in English whatever the language; an Italian read now names
 * them in Italian (#79), so its recording is compared with those names translated.
 */
const layer = () =>
  Layer.mergeAll(CatalogRepositoryLive, BundledCatalogSourceLive).pipe(Layer.provideMerge(makeMigratedSqliteLayer()));

const installed = Effect.gen(function* () {
  const repository = yield* CatalogRepository;
  yield* repository.replaceCatalog(yield* (yield* BundledCatalog).load, 'install', 1);
  return repository;
});

const language = Schema.decodeUnknownSync(CatalogLanguage);

/**
 * A recorded exercise as the read in `recordedLanguage` names it now: an English read exactly as
 * recorded, which is what pins the English names in the app's catalog to wger's.
 */
function inLanguage(payload: CatalogPayload, recordedLanguage: string): (recorded: Exercise) => Exercise {
  const lang = language(recordedLanguage);
  if (lang === 'en') return recorded => recorded;
  const idOf = (taxa: readonly { id: number; name: string }[]) => new Map(taxa.map(taxon => [taxon.name, taxon.id]));
  const categories = idOf(payload.categories);
  const equipment = idOf(payload.equipment);
  const muscles = idOf(payload.muscles.map(m => ({ id: m.id, name: m.nameEn?.trim() || m.name })));
  const muscle = (name: string) => taxonName('muscle', muscles.get(name) ?? -1, name, lang);
  return (recorded: Exercise): Exercise => ({
    ...recorded,
    category:
      recorded.category === null
        ? null
        : taxonName('category', categories.get(recorded.category) ?? -1, recorded.category, lang),
    primaryMuscles: recorded.primaryMuscles.map(muscle),
    secondaryMuscles: recorded.secondaryMuscles.map(muscle),
    equipment: recorded.equipment.map(name => taxonName('equipment', equipment.get(name) ?? -1, name, lang)),
  });
}

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
      expect(yield* repository.taxonomy('en')).toEqual(legacyReads.taxonomy);
    }),
    layer(),
  );

  itEffect(
    'answers every recorded page as the legacy repository did',
    Effect.gen(function* () {
      const repository = yield* installed;
      const payload = yield* (yield* BundledCatalog).load;

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
            result: {
              ...recorded.result,
              items: (recorded.result.items as Exercise[]).map(inLanguage(payload, recorded.language)),
            },
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
      const payload = yield* (yield* BundledCatalog).load;

      for (const recorded of legacyReads.details) {
        const exercise = yield* repository.byId(recorded.externalId, language(recorded.language));
        const expected =
          recorded.result === null ? null : inLanguage(payload, recorded.language)(recorded.result as Exercise);
        expect(exercise ?? null).toEqual(expected);
      }
      for (const recorded of legacyReads.variations) {
        expect(yield* repository.variations(recorded.externalId, language(recorded.language))).toEqual(
          (recorded.result as Exercise[]).map(inLanguage(payload, recorded.language)),
        );
      }
    }),
    layer(),
  );
});
