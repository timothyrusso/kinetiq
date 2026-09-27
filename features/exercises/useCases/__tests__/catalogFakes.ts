import { Effect, Layer } from 'effect';
import { HttpError, SqlError } from '@/features/core/error';
import { aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';
import { CatalogNotInstalled } from '@/features/exercises/domain/errors/CatalogNotInstalled';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';
import { CatalogSource } from '@/features/exercises/domain/services/CatalogSource';

const NEVER_WRITTEN: CatalogMeta = {
  source: null,
  generatedAt: null,
  installedAt: null,
  refreshedAt: null,
  exerciseCount: null,
  formatVersion: null,
};

interface RepositoryFakeOptions {
  /** The installed catalog's meta; never written by default. */
  readonly meta?: CatalogMeta;
  /** The rows reads answer with, in order. */
  readonly exercises?: readonly Exercise[];
  /** `replaceCatalog` fails, as a full disk would. */
  readonly failingWrites?: boolean;
  /** `page` fails, as a statement on a damaged database would. */
  readonly failingReads?: boolean;
}

/**
 * A `CatalogRepository` over an array. `replaceCatalog` stamps the meta as the real one does, so a
 * test reads the outcome back through `readMeta`; reads match the term against the English name.
 */
export const makeCatalogRepositoryFake = ({
  meta = NEVER_WRITTEN,
  exercises = [],
  failingWrites = false,
  failingReads = false,
}: RepositoryFakeOptions = {}) => {
  let current = meta;
  const matching = (query: string) =>
    exercises.filter(exercise => exercise.name.toLowerCase().includes(query.trim().toLowerCase()));
  return Layer.succeed(CatalogRepository, {
    replaceCatalog: (payload, kind, now) =>
      failingWrites
        ? Effect.fail(new SqlError({ message: 'replace the catalog: database or disk is full' }))
        : Effect.sync(() => {
            current = {
              source: payload.source,
              generatedAt: payload.generatedAt,
              installedAt: kind === 'install' ? now : (current.installedAt ?? now),
              refreshedAt: kind === 'refresh' ? now : null,
              exerciseCount: payload.exercises.length,
              formatVersion: payload.formatVersion,
            };
          }),
    readMeta: Effect.sync(() => current),
    page: (filter, _language, offset, limit) =>
      failingReads
        ? Effect.fail(new SqlError({ message: 'read a catalog page: database disk image is malformed' }))
        : Effect.sync(() => {
            const rows = matching(filter.query);
            return { items: rows.slice(offset, offset + limit), total: rows.length };
          }),
    byId: externalId => Effect.sync(() => exercises.find(exercise => exercise.externalId === externalId)),
    variations: externalId => Effect.sync(() => exercises.filter(exercise => exercise.externalId !== externalId)),
    taxonomy: Effect.succeed({ categories: [{ id: 1, name: 'Chest' }], equipment: [], muscles: [] }),
  });
};

/** A `CatalogSource` that answers `payload`, or fails as wger would with `failure`. */
export const makeCatalogSourceFake = (payload: CatalogPayload = aCatalogPayload(), failure?: HttpError) =>
  Layer.succeed(CatalogSource, {
    fetch: failure === undefined ? Effect.succeed(payload) : Effect.fail(failure),
  });

/** A `BundledCatalog` holding `payload`, or one whose file does not decode. */
export const makeBundledCatalogFake = (payload: CatalogPayload | 'corrupt' = aCatalogPayload()) =>
  Layer.succeed(BundledCatalog, {
    load: payload === 'corrupt' ? Effect.fail(new CatalogNotInstalled()) : Effect.succeed(payload),
  });

/** wger answering with a server error. */
export const serverError = () => new HttpError({ kind: 'server', status: 503, retryAfterSeconds: null });

/** An `ExerciseSnapshotRepository` holding `snapshots`. */
export const makeExerciseSnapshotRepositoryFake = (snapshots: readonly ExerciseSnapshot[] = []) =>
  Layer.succeed(ExerciseSnapshotRepository, {
    byId: exerciseId => Effect.sync(() => snapshots.find(snapshot => snapshot.exerciseId === exerciseId)),
  });
