import { Effect, Layer } from 'effect';
import { SqlError } from '@/features/core/error';
import { aCatalogPayload } from '@/features/exercises/__fixtures__/builders';
import type { CatalogMeta } from '@/features/exercises/domain/entities/CatalogMeta';
import { CatalogNotInstalled } from '@/features/exercises/domain/errors/CatalogNotInstalled';
import { CatalogRepository } from '@/features/exercises/domain/repositories/CatalogRepository';
import { ExerciseSnapshotRepository } from '@/features/exercises/domain/repositories/ExerciseSnapshotRepository';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import type { ExerciseSnapshot } from '@/features/exercises/domain/schemas/ExerciseSnapshotSchema';
import { BundledCatalog } from '@/features/exercises/domain/services/BundledCatalog';

const NEVER_WRITTEN: CatalogMeta = {
  datasetVersion: null,
  installedAt: null,
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
    replaceCatalog: (payload, now) =>
      failingWrites
        ? Effect.fail(new SqlError({ message: 'replace the catalog: database or disk is full' }))
        : Effect.sync(() => {
            current = {
              datasetVersion: payload.datasetVersion,
              installedAt: now,
              exerciseCount: payload.exercises.length,
              formatVersion: 2,
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
    byId: id => Effect.sync(() => exercises.find(exercise => exercise.id === id)),
    similar: id => Effect.sync(() => exercises.filter(exercise => exercise.id !== id).slice(0, 5)),
    taxonomy: () => Effect.succeed({ bodyAreas: [{ id: 'chest', name: 'Chest' }], equipment: [], muscles: [] }),
  });
};

/**
 * A `BundledCatalog` holding `payload`, or one whose files do not decode. `loads` counts the
 * reads of the dataset itself, which a launch with a current catalog must not make.
 */
export const makeBundledCatalogFake = (payload: CatalogPayload | 'corrupt' = aCatalogPayload()) => {
  const reads = { loads: 0 };
  const layer = Layer.succeed(BundledCatalog, {
    version: payload === 'corrupt' ? Effect.fail(new CatalogNotInstalled()) : Effect.succeed(payload.datasetVersion),
    load: Effect.suspend(() => {
      reads.loads += 1;
      return payload === 'corrupt' ? Effect.fail(new CatalogNotInstalled()) : Effect.succeed(payload);
    }),
  });
  return { layer, reads };
};

/** An `ExerciseSnapshotRepository` holding `snapshots`. */
export const makeExerciseSnapshotRepositoryFake = (snapshots: readonly ExerciseSnapshot[] = []) =>
  Layer.sync(ExerciseSnapshotRepository, () => {
    const stored = new Map(snapshots.map(snapshot => [snapshot.exerciseId, snapshot]));
    return {
      byId: exerciseId => Effect.sync(() => stored.get(exerciseId)),
      byIds: exerciseIds => Effect.sync(() => new Map([...stored].filter(([id]) => exerciseIds.includes(id)))),
      byName: name =>
        Effect.sync(() =>
          [...stored.values()].find(snapshot => snapshot.name.toLowerCase() === name.trim().toLowerCase()),
        ),
      upsert: snapshot => Effect.sync(() => void stored.set(snapshot.exerciseId, snapshot)),
    };
  });

/** What the catalog facades read: the catalog over `options`, and the stored `snapshots`. */
export const makeCatalogReadsFake = (
  options: RepositoryFakeOptions = {},
  snapshots: readonly ExerciseSnapshot[] = [],
) => Layer.merge(makeCatalogRepositoryFake(options), makeExerciseSnapshotRepositoryFake(snapshots));
