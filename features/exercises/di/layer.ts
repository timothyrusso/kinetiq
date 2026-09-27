import { Layer } from 'effect';
import { CatalogRepositoryLive } from '@/features/exercises/data/repositories/catalogRepositoryLive';
import { ExerciseSnapshotRepositoryLive } from '@/features/exercises/data/repositories/exerciseSnapshotRepositoryLive';
import { BundledCatalogSourceLive } from '@/features/exercises/data/services/bundledCatalogSourceLive';
import { WgerCatalogSourceLive } from '@/features/exercises/data/services/wgerCatalogSourceLive';

/**
 * Every Layer `exercises` provides: the catalog in SQLite, its wger download, the bundled copy, and
 * the stored snapshots.
 */
export const ExercisesLive = Layer.mergeAll(
  CatalogRepositoryLive,
  WgerCatalogSourceLive,
  BundledCatalogSourceLive,
  ExerciseSnapshotRepositoryLive,
);
